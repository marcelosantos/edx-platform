from django.test import TestCase

from ..management.commands import rescore_lti
from xmodule.modulestore.tests.django_utils import SharedModuleStoreTestCase


class RescoreLtiTestCase(SharedModuleStoreTestCase):
    maxDiff = 10000
    def test_command_arguments(self):
        cmd = rescore_lti.Command()
        parser = cmd.create_parser('./manage.py', 'rescore_lti')
        args = parser.parse_args(['course-v1:edX+test_course+2525_fall'])
        self.assertEqual(unicode(args['course_key']), 'course-v1:edX+test_course+2525_fall')
