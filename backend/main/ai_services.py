import hashlib
import json
import math
import re
from collections import Counter

from django.conf import settings
from openai import OpenAI
from pypdf import PdfReader

from . import models


class AIServiceUnavailable(Exception):
    pass


def _require_api_key():
    if not settings.OPENAI_API_KEY:
        raise AIServiceUnavailable('L’assistant IA n’est pas configuré. Définissez OPENAI_API_KEY dans backend/.env.')


def _client():
    _require_api_key()
    return OpenAI(api_key=settings.OPENAI_API_KEY, timeout=30.0, max_retries=1)


def _complete(instructions, prompt, max_tokens=None, json_mode=False):
    options = {}
    if json_mode:
        options['response_format'] = {'type': 'json_object'}
    response = _client().chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {'role': 'system', 'content': instructions},
            {'role': 'user', 'content': prompt},
        ],
        max_tokens=max_tokens or settings.OPENAI_MAX_TOKENS,
        temperature=0.2,
        **options,
    )
    return (response.choices[0].message.content or '').strip()


def extract_material_text(material):
    parts = [material.title, material.description, material.remarks or '']
    if material.upload:
        extension = material.upload.name.lower().rsplit('.', 1)[-1]
        try:
            with material.upload.open('rb') as uploaded_file:
                if extension == 'pdf':
                    extracted = '\n'.join(page.extract_text() or '' for page in PdfReader(uploaded_file).pages)
                    parts.append(extracted)
                elif extension in {'txt', 'md', 'csv', 'rtf'}:
                    parts.append(uploaded_file.read().decode('utf-8', errors='ignore'))
        except Exception:
            pass
    return re.sub(r'\s+', ' ', '\n'.join(parts)).strip()[:40000]


def _chunks_for_course(course):
    chunks = []
    for material in models.StudyMaterial.objects.filter(course=course).order_by('id'):
        content = material.extracted_text or extract_material_text(material)
        if not material.extracted_text and content:
            material.extracted_text = content
            material.save(update_fields=['extracted_text'])
        words = content.split()
        for start in range(0, len(words), 150):
            chunk = ' '.join(words[start:start + 180]).strip()
            if len(chunk) >= 80:
                chunks.append({'title': material.title, 'text': chunk})
    course_text = re.sub(r'\s+', ' ', course.description or '').strip()
    if len(course_text) >= 80:
        words = course_text.split()
        for start in range(0, len(words), 150):
            chunk = ' '.join(words[start:start + 180]).strip()
            if len(chunk) >= 80:
                chunks.append({'title': course.title, 'text': chunk})
    return chunks


def retrieve_chunks(course, question, limit=3):
    chunks = _chunks_for_course(course)
    if not chunks:
        return []
    query_terms = set(re.findall(r'[\wÀ-ÿ]{3,}', question.lower()))
    if not query_terms:
        return chunks[:limit]

    tokenized = [set(re.findall(r'[\wÀ-ÿ]{3,}', chunk['text'].lower())) for chunk in chunks]
    document_frequency = Counter(term for terms in tokenized for term in terms)
    scored = []
    for chunk, terms in zip(chunks, tokenized):
        overlap = query_terms & terms
        score = sum(math.log(1 + len(chunks) / document_frequency[term]) for term in overlap)
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
    content = json.dumps(
        [course.title, course.description, materials],
        ensure_ascii=False,
        separators=(',', ':'),
    )
    return hashlib.sha256(content.encode('utf-8')).hexdigest()


def answer_course_question(course, question):
    _require_api_key()
    display_question = re.sub(r'\s+', ' ', question.strip())
    normalized_question = re.sub(r'[?.!]+$', '', display_question.casefold()).strip()
    chunks = retrieve_chunks(course, question, limit=3)
    if not chunks:
        raise ValueError('Aucun contenu textuel exploitable n’est disponible pour cette formation.')
    context = '\n\n'.join(f"[{chunk['title']}] {chunk['text']}" for chunk in chunks)
    content_fingerprint = _course_content_fingerprint(course)
    cache_key = _cache_key(
        'tutor', course.pk, f'{question}\n{content_fingerprint}\n{context}',
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
            'Tu es un tuteur pédagogique. Réponds en français, en 300 tokens maximum. '
            'Utilise uniquement le CONTEXTE fourni; si la réponse manque, dis-le clairement. '
            'N’invente pas de citations.',
            f'CONTEXTE DE LA FORMATION:\n{context}\n\nQUESTION:\n{question}',
            max_tokens=300,
        )
        sources = [chunk['title'] for chunk in chunks]
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
        f'CONTEXTE DU COURS:\n{context or course.description[:3000]}\n\nQUESTION:\n{question}\n\nRÉPONSE ÉTUDIANTE:\n{answer}',
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