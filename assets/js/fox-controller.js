/**
 * Fox Companion State Machine
 * Handles the animation cycles and state transitions of the character.
 * Ensures animations complete their full sequence before transitioning.
 */
class FoxController {
    constructor(elementId) {
        this.element = document.getElementById(elementId);

        // Animation states configuration
        this.animations = {
            idle: {
                frames: 14,
                sheet: 'idle-sheet.png',
                frameRate: 125 // Frame duration (ms)
            },
            movement: {
                frames: 7,
                sheet: 'movement-sheet.png',
                frameRate: 125
            },
            sleep: {
                frames: 6,
                sheet: 'sleep-sheet.png',
                frameRate: 250 // Slower frame rate for sleeping effect
            }
        };

        this.currentState = 'idle';
        this.nextState = 'idle'; // Queued state transition
        this.currentFrame = 1;

        this.animationTimer = null;

        // Viewport and world coordinates
        this.clientX = 0;
        this.clientY = 0;
        this.worldX = 0;
        this.worldY = 0;
        this.isDetached = false;
        this.initialized = false;

        // Disable tracking on touch devices
        this.isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

        // Default to true on first visit; otherwise parse saved preference
        const savedPref = localStorage.getItem('foxTracking');
        this.isTrackingEnabled = this.isTouchDevice ? false : (savedPref === null ? true : savedPref === 'true');
        this.placeholder = null;
        this.isReturning = false;
        this.idleTimeout = null;
        this.isSleeping = false;

        // Movement speed (px/frame)
        this.speed = 3;
        this.isTracking = false;
        // Facing direction flag
        this.facingRight = true;

        if (this.element) {
            // Disable transform transitions for smooth JS-driven movement
            this.element.style.transition = 'none';

            // Ensure we use object-fit to correctly frame the sprite sheet
            this.element.style.objectFit = 'cover';

            // Preload all sprite sheets and calculate their frame aspect ratios
            Object.values(this.animations).forEach(anim => {
                const img = new Image();
                img.onload = () => {
                    anim.frameAspect = (img.naturalWidth / anim.frames) / img.naturalHeight;
                };
                img.src = `/assets/char/${anim.sheet}`;
            });

            // Set initial sprite sheet
            const initialSheet = `/assets/char/${this.animations[this.currentState].sheet}`;

            const handleLoad = () => {
                let frameAspect = this.animations[this.currentState].frameAspect;
                if (!frameAspect) {
                    const sheetWidth = this.element.naturalWidth;
                    const sheetHeight = this.element.naturalHeight;
                    if (sheetWidth && sheetHeight) {
                        frameAspect = (sheetWidth / this.animations[this.currentState].frames) / sheetHeight;
                    } else {
                        frameAspect = 1; // Fallback to square
                    }
                }
                this.element.style.width = `${this.element.clientHeight * frameAspect}px`;
                this.initLayout();
            };

            if (this.element.src.includes(initialSheet) && this.element.complete) {
                handleLoad();
            } else {
                this.element.addEventListener('load', handleLoad, { once: true });
                this.element.src = initialSheet;
            }
        }
    }

    /**
     * Requests a state change.
     * The state will only change once the current animation cycle completes.
     * @param {string} newState - The requested state (e.g., 'idle', 'movement')
     */
    setState(newState) {
        if (this.animations[newState]) {
            this.nextState = newState;
        } else {
            console.warn(`FoxController: State '${newState}' is not defined.`);
        }
    }

    initLayout() {
        // Prevent multiple initializations to avoid exponential loop bugs
        if (this.initialized) return;
        this.initialized = true;
        this.element.onload = null; // Clean up inline handlers

        this.setupToggle();
        this.startAnimation();
        this.initTracking();
    }

    setupToggle() {
        const toggle = document.getElementById('fox-toggle');
        if (toggle) {
            if (this.isTouchDevice) return; // Skip binding if UI is hidden on touch devices

            toggle.checked = this.isTrackingEnabled;
            toggle.addEventListener('change', (e) => {
                this.isTrackingEnabled = e.target.checked;
                localStorage.setItem('foxTracking', this.isTrackingEnabled);

                if (!this.isTrackingEnabled) {
                    this.isSleeping = false;
                    clearTimeout(this.idleTimeout);
                } else {
                    this.resetIdleTimer();
                }
            });
        }
    }

    detachFromLayout() {
        if (this.isDetached) return;

        const rect = this.element.getBoundingClientRect();

        // Invisible placeholder to maintain navbar layout
        this.placeholder = document.createElement('div');
        this.placeholder.style.width = rect.width + 'px';
        this.placeholder.style.height = rect.height + 'px';
        this.element.parentNode.insertBefore(this.placeholder, this.element);

        // Move element to document body
        document.body.appendChild(this.element);

        // Switch to absolute positioning
        this.element.style.position = 'absolute';
        this.element.style.left = '0px';
        this.element.style.top = '0px';
        this.element.style.zIndex = '9999'; // Ensure visibility above other elements

        // Set initial world coordinates to element center
        this.worldX = rect.left + window.scrollX + (rect.width / 2);
        this.worldY = rect.top + window.scrollY + (rect.height / 2);

        this.isDetached = true;
    }

    attachToLayout() {
        if (!this.isDetached || !this.placeholder) return;

        // Restore DOM position
        this.placeholder.parentNode.insertBefore(this.element, this.placeholder);
        this.placeholder.remove();
        this.placeholder = null;

        // Reset inline styles
        this.element.style.position = '';
        this.element.style.left = '';
        this.element.style.top = '';
        this.element.style.zIndex = '';
        this.element.style.transform = `scaleX(${this.facingRight ? 1 : -1})`;

        this.isDetached = false;
        this.isReturning = false;
        this.setState('idle');
    }

    initTracking() {
        // Bypass on touch devices
        if (this.isTouchDevice) return;

        document.addEventListener('mousemove', (e) => {
            this.clientX = e.clientX;
            this.clientY = e.clientY;
            this.isTracking = true;

            // Interrupt sleep state on mouse movement
            if (this.isSleeping) {
                this.isSleeping = false;
                this.setState('idle');
            }
            this.resetIdleTimer();
        });

        this.resetIdleTimer(); // Initialize idle timer
        requestAnimationFrame(() => this.updatePosition());
    }

    resetIdleTimer() {
        clearTimeout(this.idleTimeout);
        if (!this.isTrackingEnabled) return;

        this.idleTimeout = setTimeout(() => {
            if (this.isDetached && !this.isReturning) {
                this.isSleeping = true;
                this.setState('sleep');
            }
        }, 30000); // Trigger sleep state after 30 seconds of inactivity
    }

    updatePosition() {
        // Skip processing if tracking is disabled and element is docked
        if (!this.isTrackingEnabled && !this.isDetached) {
            requestAnimationFrame(() => this.updatePosition());
            return;
        }

        // Await initial mouse movement
        if (this.isTrackingEnabled && !this.isTracking) {
            requestAnimationFrame(() => this.updatePosition());
            return;
        }

        let targetX, targetY;
        let stopDistance = (this.element.clientWidth / 2) + 10;

        if (this.isTrackingEnabled) {
            // Switch to tracking mode
            this.isReturning = false;
            if (!this.isDetached) this.detachFromLayout();

            targetX = this.clientX + window.scrollX;
            targetY = this.clientY + window.scrollY;
        } else if (this.placeholder) {
            // Switch to return mode
            this.isReturning = true;
            const pRect = this.placeholder.getBoundingClientRect();
            targetX = pRect.left + window.scrollX + (pRect.width / 2);
            targetY = pRect.top + window.scrollY + (pRect.height / 2);
            stopDistance = 2; // Snapping threshold for docking
        }

        // Calculate Euclidean distance to target
        const dx = targetX - this.worldX;
        const dy = targetY - this.worldY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > stopDistance) {
            this.setState('movement');
        } else {
            if (this.isReturning) {
                this.attachToLayout();
                // Skip transform render after docking
                requestAnimationFrame(() => this.updatePosition());
                return;
            } else if (this.isSleeping) {
                this.setState('sleep');
            } else {
                this.setState('idle');
            }
        }

        // Apply movement if outside stop boundary
        if (this.currentState === 'movement' && distance > stopDistance) {
            const nx = dx / distance;
            const ny = dy / distance;

            this.worldX += nx * this.speed;
            this.worldY += ny * this.speed;

            // Update facing direction (with anti-flicker threshold)
            if (dx > 1) {
                this.facingRight = true;
            } else if (dx < -1) {
                this.facingRight = false;
            }
        }

        if (this.isDetached) {
            // Calculate top-left rendering coordinates
            const drawX = this.worldX - (this.element.clientWidth / 2);
            const drawY = this.worldY - (this.element.clientHeight / 2);

            // Apply transforms
            const scaleX = this.facingRight ? 1 : -1;
            this.element.style.transform = `translate(${drawX}px, ${drawY}px) scaleX(${scaleX})`;
        }

        requestAnimationFrame(() => this.updatePosition());
    }

    startAnimation() {
        // Clear existing animation loop
        this.stopAnimation();

        // Fetch state-specific frame rate
        const currentSpeed = this.animations[this.currentState].frameRate;
        this.animationTimer = setInterval(() => this.updateFrame(), currentSpeed);
    }

    stopAnimation() {
        if (this.animationTimer) clearInterval(this.animationTimer);
    }

    updateFrame() {
        this.currentFrame++;

        // Handle cycle completion
        if (this.currentFrame > this.animations[this.currentState].frames) {
            this.currentFrame = 1;

            // Apply queued state transition
            if (this.currentState !== this.nextState) {
                this.currentState = this.nextState;

                // Switch sprite sheet on state change
                this.element.src = `/assets/char/${this.animations[this.currentState].sheet}`;

                if (this.animations[this.currentState].frameAspect) {
                    this.element.style.width = `${this.element.clientHeight * this.animations[this.currentState].frameAspect}px`;
                }

                this.startAnimation();
            }
        }

        // Calculate background position percentage to show the correct frame
        const totalFrames = this.animations[this.currentState].frames;
        const positionPercent = totalFrames > 1 ? ((this.currentFrame - 1) / (totalFrames - 1)) * 100 : 0;
        this.element.style.objectPosition = `${positionPercent}% 0`;
    }
}

// Expose globally for external control
document.addEventListener('DOMContentLoaded', () => {
    window.foxCompanion = new FoxController('fox-character');
});