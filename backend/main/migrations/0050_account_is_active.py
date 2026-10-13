from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0049_teacherstudentchat_read_edit_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='teacher',
            name='is_active',
            field=models.BooleanField(default=True),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='student',
            name='is_active',
            field=models.BooleanField(default=True),
            preserve_default=False,
        ),
    ]