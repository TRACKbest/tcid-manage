import hashlib
import json
import logging
import math
import re
import unicodedata
from collections import Counter

import bleach
from django.conf import settings
from openai import BadRequestError, OpenAI
from pypdf import PdfReader

from . import models


logger = logging.getLogger(__name__)

TEXT_EXTENSIONS = {'txt', 'md', 'csv', 'rtf', 'json', 'html', 'py', 'js', 'sql'}


class AIServiceUnavailable(Exception):
    pass


def html_to_text(value):
    text = bleach.clean(re.sub(r'<(br|/p|/li|/h[1-6])\s*/?>', '\n', value or ''), tags=[], strip=True)
    return re.sub(r'[ \t\xa0]+', ' ', text).strip()


def _fold(text):
    normalized = unicodedata.normalize('NFKD', text.casefold())
    return ''.join(char for char in normalized if not unicodedata.combining(char))


def _require_api_key():
    if not settings.OPENAI_API_KEY:
        raise AIServiceUnavailable('L’assistant IA n’est pas configuré. Définissez OPENAI_API_KEY dans backend/.env.')


def _client():
    _require_api_key()
    return OpenAI(api_key=settings.OPENAI_API_KEY, timeout=30.0, max_retries=1)


def _complete(instructions, prompt, max_tokens=None, json_mode=False, history=None):
    messages = [{'role': 'system', 'content': instructions}]
    for turn in history or []:
        messages.append({'role': 'user', 'content': turn['question']})
        messages.append({'role': 'assistant', 'content': turn['answer']})
    messages.append({'role': 'user', 'content': prompt})
    options = {'response_format': {'type': 'json_object'}} if json_mode else {}
    limit = max_tokens or settings.OPENAI_MAX_TOKENS
    client = _client()
    try:
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            max_tokens=limit,
            temperature=0.2,
            **options,
        )
    except BadRequestError as error:
        # Reasoning models (o-series, gpt-5…) refuse max_tokens/temperature.
        if 'max_tokens' not in str(error) and 'temperature' not in str(error):
            raise
        logger.info('Retrying OpenAI call with max_completion_tokens for model %s', settings.OPENAI_MODEL)
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            max_completion_tokens=limit * 4,
            **options,
        )
    return (response.choices[0].message.content or '').strip()


def extract_file_text(file_field):
    if not file_field:
        return ''
    extension = file_field.name.lower().rsplit('.', 1)[-1]
    try:
        with file_field.open('rb') as uploaded_file:
            if extension == 'pdf':
                return '\n'.join(page.extract_text() or '' for page in PdfReader(uploaded_file).pages[:80])
            if extension in TEXT_EXTENSIONS:
                return uploaded_file.read(400000).decode('utf-8', errors='ignore')
    except Exception as error:
        logger.info('Could not extract text from %s: %s', file_field.name, error)
    return ''


def extract_material_text(material):
    parts = [material.title, html_to_text(material.description), material.remarks or '', extract_file_text(material.upload)]
    return re.sub(r'\s+', ' ', '\n'.join(parts)).strip()[:40000]


def extract_document_text(document):
    parts = [document.title, html_to_text(document.description), extract_file_text(document.upload)]
    return re.sub(r'\s+', ' ', '\n'.join(parts)).strip()[:40000]


def _split_words(title, content, chunks):
    words = content.split()
    for start in range(0, len(words), 150):
        chunk = ' '.join(words[start:start + 180]).strip()
        if len(chunk) >= 80:
            chunks.append({'title': title, 'text': chunk})


def _chunks_for_course(course):
    chunks = []
    for material in models.StudyMaterial.objects.filter(course=course).order_by('id'):
        content = material.extracted_text or extract_material_text(material)
        if not material.extracted_text and content:
            material.extracted_text = content
            material.save(update_fields=['extracted_text'])
        _split_words(material.title, content, chunks)
    for chapter in course.ordered_chapters().prefetch_related('documents'):
        chapter_title = chapter.title or 'Chapitre'
        _split_words(chapter_title, html_to_text(chapter.description), chunks)
        for document in chapter.documents.all():
            _split_words(f'{chapter_title} · {document.title}', document.extracted_text, chunks)
    course_text = re.sub(r'\s+', ' ', html_to_text(course.description)).strip()
    if len(course_text) >= 80:
        _split_words(course.title, course_text, chunks)
    return chunks


def retrieve_chunks(course, question, limit=3):
    chunks = _chunks_for_course(course)
    if not chunks:
        return []
    query_terms = set(re.findall(r'\w{3,}', _fold(question)))
    if not query_terms:
        return chunks[:limit]

    tokenized = [set(re.findall(r'\w{3,}', _fold(chunk['text']))) for chunk in chunks]
    title_terms = [set(re.findall(r'\w{3,}', _fold(chunk['title']))) for chunk in chunks]
    document_frequency = Counter(term for terms in tokenized for term in terms)
    scored = []
    for chunk, terms, titles in zip(chunks, tokenized, title_terms):
        overlap = query_terms & terms
        score = sum(math.log(1 + len(chunks) / document_frequency[term]) for term in overlap)
        score += 0.5 * len(query_terms & titles)
        if score:
            scored.append((score, chunk))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [chunk for _, chunk in scored[:limit]]


def _cache_key(feature, course_id, text):
    normalized = re.sub(r'\s+', ' ', text.strip().lower())
    return hashlib.sha256(f'{feature}:{course_id}:{normalized}'.encode('utf-8')).hexdigest()


def _course_content_fingerprint(course):
    materials = list(
        models.StudyMaterial.objects.filter(course_id=course.pk)
        .order_by('pk')
        .values_list('title', 'description', 'remarks', 'extracted_text')
    )
    chapters = list(
        models.Chapter.objects.filter(course_id=course.pk)
        .order_by('position', 'pk')
        .values_list('title', 'description')
    )
    documents = list(
        models.ChapterDocument.objects.filter(chapter__course_id=course.pk)
        .order_by('pk')
        .values_list('title', 'extracted_text')
    )
    content = json.dumps(
        [course.title, course.description, materials, chapters, documents],
        ensure_ascii=False,
        separators=(',', ':'),
    )
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


TUTOR_INSTRUCTIONS = (
    'Tu es le tuteur bienveillant de la plateforme TCiD Center (Madagascar). '
    'Réponds en français simple, adapté à un débutant : commence par une phrase de réponse directe, '
    'puis explique en 2 à 5 points courts (tirets), avec un exemple concret si utile. '
    'Utilise en priorité le CONTEXTE fourni et cite la source entre crochets, par exemple [Chapitre 2]. '
    'Si le contexte ne contient pas la réponse, commence par « Ce point n’est pas traité dans les supports, '
    'voici une explication générale : ». N’invente jamais de citation, de lien ou de chiffre.'
)


def _clean_history(history):
    turns = []
    for turn in (history or [])[-3:]:
        if not isinstance(turn, dict):
            continue
        question = str(turn.get('question', '')).strip()[:500]
        answer = str(turn.get('answer', '')).strip()[:1200]
        if question and answer:
            turns.append({'question': question, 'answer': answer})
    return turns


def _course_outline(course):
    titles = [chapter.title for chapter in course.ordered_chapters() if chapter.title]
    outline = '; '.join(f'{index}. {title}' for index, title in enumerate(titles, start=1))
    return f'Formation : {course.title}. Chapitres : {outline or "non renseignés"}.'


def answer_course_question(course, question, history=None):
    _require_api_key()
    display_question = re.sub(r'\s+', ' ', question.strip())
    normalized_question = re.sub(r'[?.!]+$', '', display_question.casefold()).strip()
    history = _clean_history(history)
    chunks = retrieve_chunks(course, question, limit=3)
    if chunks:
        context = '\n\n'.join(f"[{chunk['title']}] {chunk['text']}" for chunk in chunks)
    else:
        context = 'Aucun extrait ne correspond à la question.'
    outline = _course_outline(course)
    content_fingerprint = _course_content_fingerprint(course)
    history_key = json.dumps(history, ensure_ascii=False)
    cache_key = _cache_key(
        'tutor', course.pk, f'{question}\n{content_fingerprint}\n{context}\n{history_key}',
    )
    cached = models.AICachedResponse.objects.filter(
        feature='tutor', cache_key=cache_key, course=course,
    ).first()
    if cached:
        answer = cached.response
        sources = cached.metadata if hasattr(cached, 'metadata') else []
        cache_hit = True
    else:
        answer = _complete(
            TUTOR_INSTRUCTIONS,
            f'{outline}\n\nCONTEXTE DE LA FORMATION:\n{context}\n\nQUESTION:\n{question}',
            max_tokens=max(settings.OPENAI_MAX_TOKENS, 450),
            history=history,
        )
        sources = list(dict.fromkeys(chunk['title'] for chunk in chunks))
        models.AICachedResponse.objects.get_or_create(
            feature='tutor',
            cache_key=cache_key,
            defaults={'course': course, 'response': answer, 'metadata': sources},
        )
        cache_hit = False

    models.AIAssistantQuestion.objects.create(
        course=course,
        question=display_question,
        normalized_question=normalized_question,
        answer=answer,
        topic=classify_question(question),
    )
    return {'answer': answer, 'sources': sources, 'cached': cache_hit}


def describe_chapter(course, title, notes=''):
    """Draft a structured, beginner-friendly chapter description (sanitized HTML)."""
    _require_api_key()
    title = re.sub(r'\s+', ' ', str(title or '')).strip()[:150]
    if not title:
        raise ValueError('Donnez d’abord un titre au chapitre.')
    notes = html_to_text(str(notes or ''))[:3000]
    html = _complete(
        'Tu aides un formateur à présenter un chapitre vidéo à des débutants. Réponds uniquement en HTML '
        'simple (balises p, strong, ul, li, h3). Structure : une phrase d’accroche, '
        '<h3>Ce que vous allez apprendre</h3> avec 3 à 5 puces, <h3>Prérequis</h3> en une phrase, '
        'puis une astuce en gras. Français clair, 160 mots maximum.',
        f'FORMATION : {course.title}\nCHAPITRE : {title}\nNOTES DU FORMATEUR : {notes or "aucune"}',
        max_tokens=450,
    )
    html = re.sub(r'^```(?:html)?|```$', '', html.strip()).strip()
    from .serializers import clean_rich_text
    return clean_rich_text(html)


def summarize_material(material):
    if material.ai_summary:
        return material.ai_summary, True
    _require_api_key()
    content = material.extracted_text or extract_material_text(material)
    if not content:
        raise ValueError('Le document ne contient aucun texte extractible.')
    material.extracted_text = content
    summary = _complete(
        'Résume le document pour un apprenant en français, avec un titre et 4 à 6 points clés. '
        'Sois fidèle au texte et reste sous 250 tokens.',
        f"DOCUMENT: {material.title}\n\nTEXTE:\n{content[:18000]}",
        max_tokens=300,
    )
    material.ai_summary = summary
    material.save(update_fields=['extracted_text', 'ai_summary'])
    return summary, False


def generate_quiz_questions(quiz, teacher_id):
    assignment = models.CourseQuiz.objects.filter(
        quiz=quiz, course__teacher_id=teacher_id,
    ).select_related('course').first()
    if not assignment:
        raise PermissionError('Ce quiz n’est pas rattaché à un cours de cet enseignant.')
    if models.QuizQuestions.objects.filter(quiz=quiz).exists():
        raise ValueError('Ce quiz contient déjà des questions.')

    _require_api_key()
    chunks = retrieve_chunks(assignment.course, f'{quiz.title} {quiz.detail}', limit=3)
    if not chunks:
        raise ValueError('Ajoutez d’abord un document textuel ou une description au cours.')
    context = '\n\n'.join(f"[{chunk['title']}] {chunk['text']}" for chunk in chunks)
    raw = _complete(
        'Génère exactement 10 QCM en français à partir du contexte uniquement. '
        'Chaque question a 4 choix et un index de bonne réponse entre 0 et 3. '
        'Réponds uniquement en JSON sous la forme {"questions":[{"question":"...",'
        '"options":["...","...","...","..."],"answer_index":0}]} .',
        f'TITRE: {quiz.title}\nCONTEXTE:\n{context}',
        max_tokens=2200,
        json_mode=True,
    )
    payload = json.loads(raw)
    questions = payload.get('questions', [])
    if len(questions) != 10:
        raise ValueError('La génération n’a pas retourné exactement 10 questions; réessayez.')

    records = []
    for item in questions:
        if not isinstance(item, dict):
            raise ValueError('Le format du QCM généré est invalide; réessayez.')
        options = item.get('options', [])
        answer_index = item.get('answer_index')
        question = str(item.get('question', '')).strip()
        if (
            not isinstance(options, list)
            or len(options) != 4
            or any(not isinstance(option, str) or not option.strip() for option in options)
            or not question
            or type(answer_index) is not int
            or answer_index not in range(4)
        ):
            raise ValueError('Le format du QCM généré est invalide; réessayez.')
        records.append(models.QuizQuestions(
            quiz=quiz,
            questions=question[:200],
            ans1=str(options[0])[:200],
            ans2=str(options[1])[:200],
            ans3=str(options[2])[:200],
            ans4=str(options[3])[:200],
            right_ans=str(options[answer_index])[:200],
        ))
    models.QuizQuestions.objects.bulk_create(records)
    return len(records)


def grade_open_answer(course, question, answer):
    chunks = retrieve_chunks(course, question, limit=3)
    context = '\n\n'.join(f"[{chunk['title']}] {chunk['text']}" for chunk in chunks)
    content_fingerprint = _course_content_fingerprint(course)
    cache_key = _cache_key(
        'feedback', course.pk,
        f'{question}\n{answer}\n{content_fingerprint}\n{context}',
    )
    cached = models.AICachedResponse.objects.filter(
        feature='feedback', cache_key=cache_key, course=course,
    ).first()
    if cached:
        return cached.response, True

    _require_api_key()
    feedback = _complete(
        'Tu donnes un feedback pédagogique, pas une note officielle. Évalue en français selon '
        '4 critères: exactitude, raisonnement, clarté, éléments manquants. Pour chacun, donne '
        'un score sur 5 et une phrase. Termine par une piste d’amélioration. Reste sous 250 tokens.',
        f'CONTEXTE DU COURS:\n{context or html_to_text(course.description)[:3000]}\n\nQUESTION:\n{question}\n\nRÉPONSE ÉTUDIANTE:\n{answer}',
        max_tokens=300,
    )
    models.AICachedResponse.objects.get_or_create(
        feature='feedback',
        cache_key=cache_key,
        defaults={'course': course, 'response': feedback},
    )
    return feedback, False


def classify_question(question):
    text = question.casefold()
    patterns = {
        'code': ('code', 'python', 'javascript', 'fonction', 'erreur', 'bug', 'variable', 'boucle'),
        'exam': ('examen', 'quiz', 'qcm', 'note', 'révision', 'test'),
        'setup': ('installer', 'installation', 'configurer', 'configuration', 'dépendance'),
        'concept': ('pourquoi', 'explique', 'définition', 'concept', 'différence', 'comment'),
    }
    for topic, keywords in patterns.items():
        if any(keyword in text for keyword in keywords):
            return topic
    return 'other'