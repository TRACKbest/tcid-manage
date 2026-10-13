from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0048_teacher_social_links_optional'),
    ]

    operations = [
        migrations.AddField(
            model_name='teacherstudentchat',
            name='is_read',
            field=models.BooleanField(default=True),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name='teacherstudentchat',
            name='is_read',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='teacherstudentchat',
            name='edited_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]