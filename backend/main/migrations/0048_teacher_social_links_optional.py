from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0047_notification'),
    ]

    operations = [
        migrations.AlterField(
            model_name='teacher',
            name='face_url',
            field=models.URLField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='teacher',
            name='insta_url',
            field=models.URLField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='teacher',
            name='twit_url',
            field=models.URLField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='teacher',
            name='web_url',
            field=models.URLField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='teacher',
            name='you_url',
            field=models.URLField(blank=True, null=True),
        ),
    ]