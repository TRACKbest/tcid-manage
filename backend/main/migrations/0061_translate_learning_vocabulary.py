from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0060_alter_teacher_skills'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='course',
            options={'verbose_name_plural': '3. Formations'},
        ),
        migrations.AlterModelOptions(
            name='coursecategory',
            options={'verbose_name_plural': '2. Catégories de formations'},
        ),
        migrations.AlterModelOptions(
            name='coursequiz',
            options={'verbose_name_plural': '13. Questionnaires des formations'},
        ),
        migrations.AlterModelOptions(
            name='courserating',
            options={'verbose_name_plural': '7. Avis sur les formations'},
        ),
        migrations.AlterModelOptions(
            name='student',
            options={'verbose_name_plural': '5. Apprenants'},
        ),
        migrations.AlterModelOptions(
            name='studentcourseenrollment',
            options={'verbose_name_plural': '6. Inscriptions aux formations'},
        ),
        migrations.AlterModelOptions(
            name='studentfavoritecourse',
            options={'verbose_name_plural': '8. Formations favorites'},
        ),
        migrations.AlterModelOptions(
            name='studymaterial',
            options={'verbose_name_plural': '15. Supports de formation'},
        ),
        migrations.AlterModelOptions(
            name='teacher',
            options={'verbose_name_plural': '1. Formateurs'},
        ),
    ]
