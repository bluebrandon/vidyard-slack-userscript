// ==UserScript==
// @name         Slack Vidyard
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Adds Watch now and Bwamp buttons to web slack if hubs link is in channel description
// @author       Brandon Ryan
// @match        https://app.slack.com/client*
// @match        https://*.hubs.vidyard.com/*
// @icon         https://www.google.com/s2/favicons?domain=slack.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const addGlobalStyle = (css) => {
        const head = document.getElementsByTagName('head')[0];
        if (!head) { return; }
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = css;
        head.appendChild(style);
    }

    addGlobalStyle(`
    .vy-theatre {
	     height: 0;
	     background: black;
	     box-sizing: border-box;
	     cursor: row-resize;
    }
    .vy-theatre.open {
	    min-height: 10vh;
	    max-height: 70vh;
	    height: 50vh;
	    border-bottom: 5px solid #5a5a5a;
	    transition: height 0.5s;
    }
    .vy-theatre.resizing {
    	border-color: #6464d8;
	    transition: none;
    }
    .vy-theatre.resizing iframe {
	    pointer-events: none;
    }
    .vy-theatre iframe {
	    height: calc(100% - 5px);
	    width: 100%;
	    border: none;
    }
    button.vy-theatre-button.hide {
	    display: none;
    }
    button.vy-theatre-button img {
	    margin-left: 9px;
    }
    button.vy-bwamp-button {
	    margin-left: 10px;
	    background: #00569d;
    }
    button.vy-bwamp-button:hover {
	    background: #0071ce;
    }
    button.vy-bwamp-button.hide {
	    display: none;
    }
    `);

    const getElementWhenPresent = query => {
        let tries = 30;
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                const elem = document.querySelector(query);
                tries--;
                if (elem) {
                    resolve(elem);
                    clearInterval(interval);
                } else if (tries <= 0) {
                    clearInterval(interval);
                    reject(new Error(`Unable to find element [${query}]`));
                }
            }, 500);
        });
    };

    const updateUrlParameter = (uri, key, value) => {
        // remove the hash part before operating on the uri
        const i = uri.indexOf('#');
        const hash = i === -1 ? '' : uri.substr(i);
        uri = i === -1 ? uri : uri.substr(0, i);

        const re = new RegExp(`([?&])${key}=.*?(&|$)`, 'i');
        const separator = uri.indexOf('?') !== -1 ? '&' : '?';
        if (uri.match(re)) {
            uri = uri.replace(re, '$1' + key + '=' + value + '$2');
        } else {
            uri = `${uri}${separator}${key}=${value}`;
        }
        return `${uri}${hash}`;
    };

    const resizeVertical = el => {
        el.addEventListener('mousedown', event => {
            event.preventDefault();
            const startingHeight = el.offsetHeight;
            const yOffset = event.pageY;

            const mouseDragHandler = moveEvent => {
                moveEvent.preventDefault();
                const primaryButtonPressed = moveEvent.buttons === 1;
                if (!primaryButtonPressed) {
                    window.removeEventListener('mousemove', mouseDragHandler);
                    el.classList.remove('resizing');
                    return;
                }
                el.classList.add('resizing');
                el.style.height = `${moveEvent.pageY - yOffset + startingHeight}px`;
            };

            window.addEventListener('mousemove', mouseDragHandler);
        });
    };

    const insertAfter = (newNode, existingNode) => {
        existingNode.parentNode.insertBefore(newNode, existingNode.nextSibling);
    };

     const insertBefore = (newNode, existingNode) => {
        existingNode.parentNode.insertBefore(newNode, existingNode);
    };

    const onMutation = (el, onChange) => {
        const config = { childList: true, characterData: false, attributes: false, subtree: true };
        const MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
        const observer = new MutationObserver(onChange);
        observer.observe(el, config);
    };

    let theatre;
    let iframe;
    let button;
    let link;
    let bwamp;

    const VidyardSlack = {
        openTheatreMode: () => {
            theatre.classList.add('open');
            const popup = window.open (updateUrlParameter(link, 'slack_theatre', 1), 'popup', 'width=400,height=300');
            const popupInterval = setInterval(() => popup.postMessage('', '*'), 500);

            // Stop if it's taking longer than 10s to hear a response
            setTimeout(() => clearInterval(popupInterval), 10000);

            window.addEventListener('message', e => {
                if (e.origin.includes('hubs.vidyard.com')) {
                    iframe.src = e.data;
                    clearInterval(popupInterval);
                }
            });
        },

        updateTheatreMode: () => {
            const description = document.querySelector('.p-classic_nav__model__title__info__topic__content');
            link = description?.querySelector('a')?.href;

            if (link?.includes('hubs.vidyard.com')) {
                button.classList.remove('hide');
                bwamp.classList.remove('hide');
            } else {
                theatre.classList.remove('open');
                theatre.style = '';
                iframe.src = '';
                button.classList.add('hide');
                bwamp.classList.add('hide');
            }
        },

        openBwamp: () => {
            window.open('https://bwamp.me/vidyard.com/', 'popup', `width=400,height=${window.innerHeight}`);
        },

        init: async () => {
            const container = await getElementWhenPresent('.p-workspace__primary_view_contents');
            const header = container.querySelector('.p-bookmarks_bar__dnd');

            console.log(header);

            theatre = document.createElement('div');
            iframe = document.createElement('iframe');
            button = document.createElement('button');
            bwamp = document.createElement('button');

            // Set up bwamp button
            bwamp.className = 'c-button c-button--primary c-button--small vy-bwamp-button hide';
            bwamp.innerHTML = 'BWAMP 🎉';

            bwamp.addEventListener('click', () => {
                VidyardSlack.openBwamp();
            });

            // Setup button
            button.className = 'c-button c-button--primary c-button--small vy-theatre-button hide';
            button.innerHTML = 'Watch Now';

            button.addEventListener('click', () => {
                VidyardSlack.openTheatreMode();
            });

            // Setup theatre container
            theatre.className = 'vy-theatre';

            // Build DOM
            insertBefore(button, container.querySelector('.p-view_header__actions'));
            insertBefore(bwamp, container.querySelector('.p-view_header__actions'));
            theatre.appendChild(iframe);
            setTimeout(container.prepend(theatre), 300);
            resizeVertical(theatre);

            // Start Updating based on description changes
            onMutation(header, VidyardSlack.updateTheatreMode);
            VidyardSlack.updateTheatreMode();
        },
    };

    const VidyardHubSlack = {
        init: async function() {
            window.addEventListener('message', async e => {
                if (e.origin === 'https://app.slack.com') {
                    const iframe = await getElementWhenPresent('iframe');
                    const playerUrl = updateUrlParameter(iframe.src, 'slack_theatre', 1);

                    e.source.postMessage(playerUrl, e.origin);
                    window.close();
                }
            });
        },
    };

    // Run the script on slack
    if (window.location.href.indexOf('slack') !== -1) {
        VidyardSlack.init();
    }

    // Run the script on our hubs page
    if (window.location.href.indexOf('hubs') !== -1) {
        VidyardHubSlack.init();
    }
})();
