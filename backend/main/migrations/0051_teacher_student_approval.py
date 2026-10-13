from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0050_account_is_active'),
    ]

    operations = [
        migrations.AlterField(
            model_name='teacher',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AlterField(
            model_name='student',
            name='is_active',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='teacher',
            name='is_approved',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='student',
            name='is_approved',
            field=models.BooleanField(default=True),
        ),
    ]