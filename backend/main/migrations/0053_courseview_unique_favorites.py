from django.db import migrations, models
import django.db.models.deletion


def remove_duplicate_favorites(apps, schema_editor):
    Favorite = apps.get_model('main', 'StudentFavoriteCourse')
    database = schema_editor.connection.alias
    pairs = list(
        Favorite.objects.using(database)
        .values('student_id', 'course_id')
        .distinct()
    )
    for pair in pairs:
        favorites = list(
            Favorite.objects.using(database)
            .filter(student_id=pair['student_id'], course_id=pair['course_id'])
            .order_by('id')
            .values_list('id', 'status')
        )
        if len(favorites) > 1:
            Favorite.objects.using(database).filter(id=favorites[0][0]).update(
                status=any(status for _, status in favorites)
            )
            Favorite.objects.using(database).filter(
                id__in=[favorite_id for favorite_id, _ in favorites[1:]]
            ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('main', '0052_alter_course_description'),
    ]

    operations = [
        migrations.RunPython(remove_duplicate_favorites, migrations.RunPython.noop),
        migrations.CreateModel(
            name='CourseView',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('viewed_at', models.DateTimeField(auto_now_add=True)),
                ('course', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='view_records', to='main.course')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='course_view_records', to='main.student')),
            ],
        ),
        migrations.AddConstraint(
            model_name='studentfavoritecourse',
            constraint=models.UniqueConstraint(fields=('student', 'course'), name='unique_student_course_favorite'),
        ),
        migrations.AddConstraint(
            model_name='courseview',
            constraint=models.UniqueConstraint(fields=('student', 'course'), name='unique_student_course_view'),
        ),
    ]