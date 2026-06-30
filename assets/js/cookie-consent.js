const CAT_NECESSARY = 'necessary';
const CAT_ANALYTICS = 'analytics';
const CAT_MARKETING = 'marketing';

function openCookiePreferences(event) {
  const trigger = event.target.closest('[data-cookie-preferences]');
  if (!trigger) return;

  event.preventDefault();

  if (window.CookieConsent && typeof window.CookieConsent.showPreferences === 'function') {
    window.CookieConsent.showPreferences();
  }
}

document.addEventListener('click', openCookiePreferences);

function updateGoogleConsent() {
  if (!window.CookieConsent) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };

  const analyticsConsent = window.CookieConsent.acceptedCategory(CAT_ANALYTICS) ? 'granted' : 'denied';
  const marketingConsent = window.CookieConsent.acceptedCategory(CAT_MARKETING) ? 'granted' : 'denied';

  window.gtag('consent', 'update', {
    analytics_storage: analyticsConsent,
    ad_storage: marketingConsent,
    ad_user_data: marketingConsent,
    ad_personalization: marketingConsent,
    personalization_storage: marketingConsent,
    functionality_storage: 'granted',
    security_storage: 'granted'
  });

  window.dataLayer.push({
    event: 'cookie_consent_update',
    analytics_storage: analyticsConsent,
    ad_storage: marketingConsent
  });
}

function initCookieConsent() {
  if (!window.CookieConsent || typeof window.CookieConsent.run !== 'function') {
    console.warn('CookieConsent library did not load. Cookie preferences cannot be opened.');
    return;
  }

  window.CookieConsent.run({
    cookie: {
      name: 'etal_cookie_consent',
      sameSite: 'Lax'
    },

    guiOptions: {
      consentModal: {
        layout: 'box inline',
        position: 'bottom right',
        equalWeightButtons: true,
        flipButtons: false
      },
      preferencesModal: {
        layout: 'box',
        equalWeightButtons: true,
        flipButtons: false
      }
    },

    onFirstConsent: updateGoogleConsent,
    onConsent: updateGoogleConsent,
    onChange: updateGoogleConsent,

    categories: {
      [CAT_NECESSARY]: {
        enabled: true,
        readOnly: true
      },
      [CAT_ANALYTICS]: {
        autoClear: {
          cookies: [
            { name: /^_ga/ },
            { name: '_gid' }
          ]
        }
      },
      [CAT_MARKETING]: {}
    },

    language: {
      default: 'en',
      translations: {
        en: {
          consentModal: {
            title: 'Cookie preferences',
            description: 'I use essential cookies to run this site and optional analytics cookies to understand how visitors use it. You can accept, reject, or manage your choices.',
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Reject optional',
            showPreferencesBtn: 'Manage preferences'
          },
          preferencesModal: {
            title: 'Manage cookie preferences',
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Reject optional',
            savePreferencesBtn: 'Save preferences',
            closeIconLabel: 'Close',
            sections: [
              {
                title: 'Your choices',
                description: 'You can update your cookie preferences at any time. Essential cookies are always on because the site needs them to function.'
              },
              {
                title: 'Essential cookies',
                description: 'Required for the site to work. These cannot be switched off.',
                linkedCategory: CAT_NECESSARY
              },
              {
                title: 'Analytics cookies',
                description: 'Help me understand site usage through Google Analytics. These are only enabled with your consent.',
                linkedCategory: CAT_ANALYTICS
              },
              {
                title: 'Marketing cookies',
                description: 'Reserved for advertising or remarketing tags if they are added later. These are off unless you allow them.',
                linkedCategory: CAT_MARKETING
              },
              {
                title: 'Contact',
                description: 'Questions about this site can be sent through the contact section.'
              }
            ]
          }
        }
      }
    }
  });
}

initCookieConsent();
