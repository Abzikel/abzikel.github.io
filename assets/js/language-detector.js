/**
 * Language Detection and Routing
 * Evaluates user preferences and browser language to route to the appropriate localization.
 * Must be executed synchronously in the <head> to prevent content flashing (FOUC).
 */
(function () {
    const langPref = localStorage.getItem('langPref');

    // Respect manual user override
    if (langPref === 'en') {
        window.location.replace('/en/');
        return;
    }

    // Fallback to browser language detection if no preference is set
    if (!langPref) {
        const browserLang = navigator.language || navigator.userLanguage;
        if (browserLang && browserLang.startsWith('en')) {
            window.location.replace('/en/');
        }
    }
})();