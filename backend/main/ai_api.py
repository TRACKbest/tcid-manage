import logging
import re

from django.conf import settings
from django.db.models import Count
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from . import models
from .ai_services import (
    AIServiceUnavailable,
    answer_course_question,
    describe_chapter,
    generate_quiz_questions,
    grade_open_answer,
    summarize_material,
)


logger = logging.getLogger(__name__)


def _approved_student(student_id, course_id):
    student = get_object_or_404(models.Student, pk=student_id, is_active=True, is_approved=True)
    enrolled = models.StudentCourseEnrollment.objects.filter(
        student=student,
        course_id=course_id,
        status=models.StudentCourseEnrollment.STATUS_APPROVED,
    ).exists()
    if not enrolled:
        raise PermissionDenied('Une inscription approuvée est nécessaire pour utiliser l’assistant.')
    return student


def _teacher_course(course_id, teacher_id):
    course = get_object_or_404(models.Course, pk=course_id)
    if str(course.teacher_id) != str(teacher_id):
        raise PermissionDenied('Seul le formateur de la formation peut accéder à cette fonction.')
    return course


def _ai_error_response(error):
    if isinstance(error, AIServiceUnavailable):
        return Response({'detail': str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
    if isinstance(error, ValueError):
        return Response({'detail': str(error)}, status=status.HTTP_400_BAD_REQUEST)
    logger.exception('AI provider request failed')
    return Response(
        {'detail': 'Le service IA est temporairement indisponible. Réessayez plus tard.'},
        status=status.HTTP_503_SERVICE_UNAVAILABLE,
    )


class CourseTutorAPIView(APIView):
    def post(self, request, course_id):
        course = get_object_or_404(models.Course, pk=course_id)
        _approved_student(request.data.get('student_id'), course_id)
        question = str(request.data.get('question', '')).strip()
        if not question or len(question) > 1000:
            return Response({'detail': 'La question doit contenir entre 1 et 1 000 caractères.'}, status=400)
        try:
            history = request.data.get('history')
            result = answer_course_question(course, question, history if isinstance(history, list) else None)
        except (AIServiceUnavailable, ValueError) as error:
            return _ai_error_response(error)
        except Exception as error:
            return _ai_error_response(error)
        return Response(result)


class CourseAnswerFeedbackAPIView(APIView):
    def post(self, request, course_id):
        course = get_object_or_404(models.Course, pk=course_id)
        _approved_student(request.data.get('student_id'), course_id)
        question = str(request.data.get('question', '')).strip()
        answer = str(request.data.get('answer', '')).strip()
        if not question or not answer:
            return Response({'detail': 'La question et la réponse sont obligatoires.'}, status=400)
        if len(answer.split()) > 500:
            return Response({'detail': 'La réponse est limitée à 500 mots.'}, status=400)
        try:
            feedback, cached = grade_open_answer(course, question[:1000], answer)
        except (AIServiceUnavailable, ValueError) as error:
            return _ai_error_response(error)
        except Exception as error:
            return _ai_error_response(error)
        return Response({'feedback': feedback, 'cached': cached})


class StudyMaterialSummaryAPIView(APIView):
    def post(self, request, material_id):
        material = get_object_or_404(models.StudyMaterial.objects.select_related('course'), pk=material_id)
        teacher_id = request.data.get('teacher_id')
        student_id = request.data.get('student_id')
        if teacher_id:
            _teacher_course(material.course_id, teacher_id)
        elif student_id:
            _approved_student(student_id, material.course_id)
        else:
            raise PermissionDenied('Une identité de formateur ou d’apprenant est nécessaire.')

        try:
            summary, cached = summarize_material(material)
        except (AIServiceUnavailable, ValueError) as error:
            return _ai_error_response(error)
        except Exception as error:
            return _ai_error_response(error)
        return Response({'summary': summary, 'cached': cached})


class TeacherQuizGenerationAPIView(APIView):
    def post(self, request, quiz_id):
        quiz = get_object_or_404(models.Quiz, pk=quiz_id)
        teacher_id = request.data.get('teacher_id')
        if str(quiz.teacher_id) != str(teacher_id):
            raise PermissionDenied('Seul le formateur propriétaire du quiz peut générer ses questions.')
        try:
            generated = generate_quiz_questions(quiz, teacher_id)
        except PermissionError as error:
            raise PermissionDenied(str(error))
        except (AIServiceUnavailable, ValueError) as error:
            return _ai_error_response(error)
        except Exception as error:
            return _ai_error_response(error)
        return Response({'generated': generated}, status=status.HTTP_201_CREATED)


class TeacherCourseAIAnalyticsAPIView(APIView):
    def get(self, request, course_id):
        teacher_id = request.query_params.get('teacher_id')
        course = _teacher_course(course_id, teacher_id)
        counts = list(
            models.AIAssistantQuestion.objects.filter(course=course)
            .values('topic')
            .annotate(questions=Count('id'))
            .order_by('-questions', 'topic')
        )
        total = sum(item['questions'] for item in counts)
        return Response({
            'course': course.title,
            'total_questions': total,
            'topics': [
                {
                    'topic': item['topic'],
                    'label': dict(models.AIAssistantQuestion.TOPIC_CHOICES).get(item['topic'], item['topic']),
                    'questions': item['questions'],
                    'percentage': round(item['questions'] * 100 / total) if total else 0,
                }
                for item in counts
            ],
        })


class TeacherChapterDescriptionAPIView(APIView):
    def post(self, request, course_id):
        course = _teacher_course(course_id, request.data.get('teacher_id'))
        try:
            description = describe_chapter(course, request.data.get('title'), request.data.get('notes'))
        except (AIServiceUnavailable, ValueError) as error:
            return _ai_error_response(error)
        except Exception as error:
            return _ai_error_response(error)
        return Response({'description': description})
