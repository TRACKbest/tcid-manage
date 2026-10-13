from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0045_alter_chapter_course_alter_chapter_title'),
    ]

    operations = [
        migrations.AddField(
            model_name='studentcourseenrollment',
            name='status',
            field=models.CharField(
                choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')],
                default='approved',
                max_length=10,
            ),
        ),
        migrations.AlterField(
            model_name='studentcourseenrollment',
            name='status',
            field=models.CharField(
                choices=[('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected')],
                default='pending',
                max_length=10,
            ),
        ),
    ]