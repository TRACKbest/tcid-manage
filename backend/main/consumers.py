import json
import uuid
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.core import signing

from . import models
from .liveclass_api import TOKEN_SALT


@database_sync_to_async
def resolve_participant(classroom_id, token):
    try:
        identity = signing.loads(token, salt=TOKEN_SALT, max_age=8 * 60 * 60)
        classroom = models.LiveClassroom.objects.select_related('course').get(
            pk=classroom_id,
            status=models.LiveClassroom.STATUS_LIVE,
        )
        role = identity.get('role')
        participant_id = identity.get('participant_id')
        if identity.get('classroom_id') != classroom.pk:
            return None

        if role == 'teacher':
            teacher = models.Teacher.objects.get(pk=participant_id, is_active=True, is_approved=True)
            if classroom.course.teacher_id != teacher.pk:
                return None
            display_name = teacher.full_name
        elif role == 'student':
            student = models.Student.objects.get(pk=participant_id, is_active=True, is_approved=True)
            enrolled = models.StudentCourseEnrollment.objects.filter(
                course=classroom.course,
                student=student,
                status=models.StudentCourseEnrollment.STATUS_APPROVED,
            ).exists()
            if not enrolled:
                return None
            display_name = student.fullname
        else:
            return None

        return {'role': role, 'participant_id': participant_id, 'display_name': display_name}
    except (signing.BadSignature, models.LiveClassroom.DoesNotExist,
            models.Teacher.DoesNotExist, models.Student.DoesNotExist,
            TypeError, ValueError):
        return None


class LiveClassroomConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        classroom_id = self.scope['url_route']['kwargs']['classroom_id']
        query = parse_qs(self.scope['query_string'].decode('utf-8'))
        token = query.get('token', [''])[0]
        participant = await resolve_participant(classroom_id, token)
        if not participant:
            await self.close(code=4401)
            return

        self.classroom_id = int(classroom_id)
        self.room_group_name = f'live_classroom_{self.classroom_id}'
        self.peer_id = uuid.uuid4().hex
        self.role = participant['role']
        self.participant_id = participant['participant_id']
        self.display_name = participant['display_name']

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()
        await self.send_json({
            'type': 'joined',
            'peer_id': self.peer_id,
            'role': self.role,
            'display_name': self.display_name,
        })
        await self.channel_layer.group_send(self.room_group_name, {
            'type': 'room.event',
            'payload': {
                'type': 'participant_joined',
                'participant': {
                    'peer_id': self.peer_id,
                    'role': self.role,
                    'display_name': self.display_name,
                },
            },
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_send(self.room_group_name, {
                'type': 'room.event',
                'payload': {'type': 'participant_left', 'peer_id': self.peer_id},
            })
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        message_type = content.get('type')
        payload = None

        if message_type == 'signal':
            target = content.get('target')
            signal = content.get('signal')
            if isinstance(target, str) and isinstance(signal, dict):
                payload = {'type': 'signal', 'target': target, 'from': self.peer_id, 'signal': signal}
        elif message_type == 'chat':
            text = content.get('text')
            if isinstance(text, str) and text.strip() and len(text) <= 500:
                payload = {
                    'type': 'chat',
                    'text': text.strip(),
                    'display_name': self.display_name,
                    'role': self.role,
                }
        elif message_type == 'raise_hand' and self.role == 'student':
            payload = {'type': 'raise_hand', 'peer_id': self.peer_id, 'up': bool(content.get('up'))}
        elif message_type == 'moderate' and self.role == 'teacher':
            target = content.get('target')
            control = content.get('control')
            if isinstance(target, str) and control in {'microphone', 'camera'}:
                payload = {
                    'type': 'moderate',
                    'target': target,
                    'control': control,
                    'enabled': bool(content.get('enabled')),
                }
        elif message_type == 'whiteboard':
            stroke = content.get('stroke')
            if isinstance(stroke, dict) and len(json.dumps(stroke)) <= 12000:
                payload = {'type': 'whiteboard', 'stroke': stroke, 'peer_id': self.peer_id}
        elif message_type == 'whiteboard_clear' and self.role == 'teacher':
            payload = {'type': 'whiteboard_clear'}
        elif message_type == 'roster_request':
            payload = {'type': 'roster_request', 'requester': self.peer_id}
        elif message_type == 'roster_response':
            target = content.get('target')
            if isinstance(target, str) and target != self.peer_id:
                payload = {
                    'type': 'roster_response',
                    'target': target,
                    'participant': {
                        'peer_id': self.peer_id,
                        'role': self.role,
                        'display_name': self.display_name,
                    },
                }

        if payload:
            await self.channel_layer.group_send(
                self.room_group_name,
                {'type': 'room.event', 'payload': payload},
            )

    async def room_event(self, event):
        payload = event['payload']
        target = payload.get('target')
        if target and target != self.peer_id:
            return
        await self.send_json(payload)