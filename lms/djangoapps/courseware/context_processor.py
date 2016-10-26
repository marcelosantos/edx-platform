"""
This is the courseware context_processor module.

This is meant to simplify the process of sending user preferences (espec. time_zone and pref-lang)
to the templates without having to append every view file.

"""
from openedx.core.djangoapps.user_api.errors import UserNotFound, UserAPIInternalError
from openedx.core.djangoapps.user_api.preferences.api import get_user_preferences
import request_cache

RETRIEVABLE_PREFERENCES = {
    'user_timezone': 'time_zone',
    'user_language': 'pref-lang'
}
CACHE_NAME = "context_processor.user_timezone_preferences"


def user_timezone_locale_prefs(request):
    """
    Checks if request has an authenticated user.
    If so, sends set (or none if unset) time_zone and language prefs.

    This interacts with the DateUtils to either display preferred or attempt to determine
    system/browser set time_zones and languages

    """
    user_prefs = {
        'user_timezone': None,
        'user_language': None,
    }

    cached_value = request_cache.get_cache(CACHE_NAME)
    if not cached_value:
        if hasattr(request, 'user') and request.user.is_authenticated():
            try:
                retrieved_user_preferences = get_user_preferences(request.user)
            except (UserNotFound, UserAPIInternalError):
                cached_value.update(user_prefs)
                return user_prefs
            for key, prefs in RETRIEVABLE_PREFERENCES.iteritems():
                if prefs in retrieved_user_preferences:
                    user_prefs[key] = retrieved_user_preferences[prefs]

    cached_value.update(user_prefs)
    return user_prefs
