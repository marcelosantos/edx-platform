"""
Management command to rescore all lti problems for the given course for all users.
"""

import textwrap

from django.conf import settings
from django.core.management import BaseCommand

from opaque_keys.edx.keys import CourseKey

from lti_provider.models import GradedAssignment
from lti_provider import tasks
from student.models import CourseEnrollment


class Command(BaseCommand):
    """
    Rescore all lti problems for the given course for all users.

    Examples:

        ./manage.py rescore_lti course_key
        ./manage.py rescore_lti
    """

    help = textwrap.dedent(__doc__)

    can_import_settings = True

    def add_arguments(self, parser):
        parser.add_argument(u'course_keys', type=CourseKey.from_string, nargs='+')

    def handle(self, *args, **options):
        for course_key in options[u'course_keys']:
            users = self._iter_users_in_course(course_key)
            for user in users:
                assignments = self._iter_lti_assignments(user, course_key)
                for assignment in assignments:
                    tasks.send_composite_outcome.apply_async(
                        (user.id, course_key, assignment.id, assignment.version_number),
                        countdown=settings.LTI_AGGREGATE_SCORE_PASSBACK_DELAY,
                    )

    def _iter_lti_assignments(self, user, course_key):
        """
        Get all the graded assignments for a given user in the given course
        """

        return GradedAssignment.objects.filter(user=user, course_key=course_key)

    def _iter_users_in_course(self, course_key):
        """
        Get all the users actively enrolled in the given course
        """
        for enrollment in CourseEnrollment.objects.filter(is_active=True, course_key=course_key).select_releted('user'):
            yield enrollment.user
