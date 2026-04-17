// Clean URL hash on page load to prevent it from persisting on reloads
if (window.location.hash) {
    // Replaces the current entry in the history stack without reloading
    history.replaceState(null, '', window.location.pathname + window.location.search);
}

// Automatically update the copyright year in the footer
document.getElementById('current-year').textContent = new Date().getFullYear();

// Scroll Animation using IntersectionObserver
const animationOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.15
};

const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Add the class that triggers the CSS transition
            entry.target.classList.add('is-visible');

            // Unobserve the element so the animation to happen once
            observer.unobserve(entry.target);
        }
    });
}, animationOptions);

// Select all elements with the animation class and observe them
const animatedElements = document.querySelectorAll('.fade-in-section');
animatedElements.forEach(el => observer.observe(el));