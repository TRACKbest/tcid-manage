from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0059_learninggroup_studentassignment_group_groupmessage_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='teacher',
            name='skills',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
