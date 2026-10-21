from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from rest_framework import serializers


def hash_password(raw_password):
    return make_password(raw_password) if raw_password else raw_password


def is_hashed(stored_password):
    try:
        identify_hasher(stored_password or '')
    except ValueError:
        return False
    return True


def verify_password(account, raw_password):
    """Check a learner/trainer password, upgrading legacy plain-text values to a hash."""
    stored = account.password or ''
    if not raw_password or not stored:
        return False
    if is_hashed(stored):
        return check_password(raw_password, stored)
    if stored != raw_password:
        return False
    account.password = make_password(raw_password)
    account.save(update_fields=['password'])
    return True


class PasswordHashingMixin:
    """Serializer mixin: hash ``password`` on write and keep the old one when left blank."""

    def create(self, validated_data):
        if not validated_data.get('password'):
            raise serializers.ValidationError({'password': ['Le mot de passe est obligatoire.']})
        if len(validated_data['password']) < 6:
            raise serializers.ValidationError({'password': ['Le mot de passe doit contenir au moins 6 caractères.']})
        validated_data['password'] = hash_password(validated_data['password'])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'password' in validated_data:
            if validated_data['password']:
                validated_data['password'] = hash_password(validated_data['password'])
            else:
                validated_data.pop('password')
        return super().update(instance, validated_data)
