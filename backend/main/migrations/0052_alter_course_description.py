from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0051_teacher_student_approval'),
    ]

    operations = [
        migrations.AlterField(
            model_name='course',
            name='description',
            field=models.TextField(blank=True, default=''),
        ),
    ]