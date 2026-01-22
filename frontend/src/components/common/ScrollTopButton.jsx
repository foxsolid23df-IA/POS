import React, { useState, useEffect } from 'react';

export const ScrollTopButton = () => {
    const [isVisible, setIsVisible] = useState(false);
    // Keep track of which element triggered the scroll to target it back
    const [targetElement, setTargetElement] = useState(null);

    const checkScroll = (e) => {
        const element = e.target;
        // Ignore events from non-scrollable targets or very small changes
        if (!element || typeof element.scrollTop !== 'number') return;

        // If an element is scrolled more than 300px, show the button
        if (element.scrollTop > 300) {
            setIsVisible(true);
            setTargetElement(element);
        } else {
            // Only hide if the *currently tracked* element is back to top
            // This prevents hiding if I scroll a small container while a big one is still scrolled
            if (element === targetElement || !targetElement || targetElement.scrollTop <= 300) {
                // Check if ANY scrollable parent or the Main Content is still scrolled as a fallback
                const main = document.querySelector('.main-content');
                if (main && main.scrollTop > 300) {
                    setTargetElement(main);
                    setIsVisible(true);
                } else {
                    setIsVisible(false);
                }
            }
        }
    };

    const scrollToTop = () => {
        if (targetElement && targetElement.scrollTo) {
            try {
                targetElement.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
            } catch (e) {
                // Fallback for older browsers or if element is detached
                targetElement.scrollTop = 0;
            }
        } else {
            // Fallback: try main content and window
            const mainContent = document.querySelector('.main-content');
            if (mainContent) {
                mainContent.scrollTo({ top: 0, behavior: 'smooth' });
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        // Use capture: true to detect scroll events from ANY descendant
        // This is crucial for dashboards where tables have internal scrolling
        const mainContent = document.querySelector('.main-content');

        // Handler wrapper to normalize event
        const handleScroll = (e) => checkScroll(e);

        // We listen on the document/window with capture to catch EVERYTHING
        window.addEventListener('scroll', handleScroll, { capture: true });

        // Check initial state
        if (mainContent) handleScroll({ target: mainContent });

        return () => {
            window.removeEventListener('scroll', handleScroll, { capture: true });
        };
    }, [targetElement]);

    return (
        <button
            onClick={scrollToTop}
            className={`fixed bottom-6 right-6 md:bottom-8 md:right-8 z-[9999] p-3 rounded-full bg-emerald-500 text-white shadow-lg 
                hover:bg-emerald-600 transition-all duration-300 transform 
                focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 dark:focus:ring-offset-slate-900
                ${isVisible ? 'opacity-100 translate-y-0 scale-110' : 'opacity-0 translate-y-10 scale-0 pointer-events-none'}`}
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
            aria-label="Volver arriba"
        >
            <span className="material-icons-outlined text-2xl">arrow_upward</span>
        </button>
    );
};
