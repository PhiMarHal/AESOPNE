// farcadeIntegration.js
// Script to integrate Farcade SDK into AESOPNE index.html

const fs = require('fs');
const path = require('path');

const config = {
    indexTemplate: 'index.html',
    outputFile: 'index.farcade.html',
};

function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return null;
    }
}

function writeFile(filePath, content) {
    try {
        fs.writeFileSync(filePath, content);
        console.log(`Successfully created file: ${filePath}`);
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error.message);
    }
}

function injectFarcadeSDK(html) {
    console.log('Injecting Farcade SDK script tag...');
    const farcadeScriptTag = '    <script src="https://cdn.jsdelivr.net/npm/@farcade/game-sdk@latest/dist/index.min.js"></script>';
    // Inject the Farcade SDK script right before the closing </head> tag
    return html.replace(/<\/head>/, `${farcadeScriptTag}\n</head>`);
}

function injectFarcadeGameLogic(html) {
    console.log('Injecting Farcade SDK game logic...');

    let modifiedHtml = html;

    // 1. Inject ready() call right when showTitleScreen() is called
    const showTitleScreenPattern = /(showTitleScreen\(\) \{[\s\S]*?this\.gameElements\.forEach\(element => element\.setVisible\(false\)\);)/;
    modifiedHtml = modifiedHtml.replace(showTitleScreenPattern, (match) => {
        return `${match}

                // Farcade SDK: Signal that the game is fully loaded and ready to play
                if (window.FarcadeSDK) {
                    window.FarcadeSDK.singlePlayer.actions.ready();
                    console.log('Farcade SDK: Game ready signal sent.');
                }`;
    });

    // 2. UPDATED: Inject gameOver() call in showGameOverScreen() - updated pattern for new layout
    const gameOverScreenPattern = /(this\.playButton\.setPosition\(450, 1360\);[\s\S]*?this\.playButton\.setInteractive\(\);)/;
    modifiedHtml = modifiedHtml.replace(gameOverScreenPattern, (match) => {
        return `${match}

                // Farcade SDK: Hide our play button and call SDK gameOver after a delay
                if (window.FarcadeSDK) {
                    this.playButton.setVisible(false); // Hide our button since Farcade UI takes over
                    
                    this.time.delayedCall(1000, () => {
                        window.FarcadeSDK.singlePlayer.actions.gameOver({ score: this.maxHeight });
                        console.log('Farcade SDK: Game over signal sent with score:', this.maxHeight);
                    });
                }`;
    });

    // 3. FALLBACK: If the above pattern doesn't match, try a more generic approach
    if (!modifiedHtml.includes('window.FarcadeSDK.singlePlayer.actions.gameOver')) {
        console.log('Primary gameOver pattern not found, trying fallback pattern...');

        // Look for the play again button setup in showGameOverScreen
        const fallbackPattern = /(this\.playButton\.removeAllListeners\(\);[\s\S]*?this\.startGame\(\);[\s\S]*?\}\);)/;
        modifiedHtml = modifiedHtml.replace(fallbackPattern, (match) => {
            return `${match}

                // Farcade SDK: Call gameOver after button setup (fallback injection)
                if (window.FarcadeSDK) {
                    this.time.delayedCall(1000, () => {
                        window.FarcadeSDK.singlePlayer.actions.gameOver({ score: this.maxHeight });
                        console.log('Farcade SDK: Game over signal sent with score (fallback):', this.maxHeight);
                    });
                }`;
        });
    }

    // 4. Inject event handlers after the Phaser game instance is created
    const phaserGameInstancePattern = /(const game = new Phaser\.Game\(config\);)/;
    modifiedHtml = modifiedHtml.replace(phaserGameInstancePattern, (match) => {
        return `${match}

        // Farcade SDK: Register event handlers for 'play_again' and 'toggle_mute'
        if (window.FarcadeSDK) {
            // Handle play again requests from Farcade
            window.FarcadeSDK.on('play_again', () => {
                console.log('Farcade SDK: Play again requested.');
                const activeScene = game.scene.getScene('VerticalLauncher');
                if (activeScene && activeScene.startGame) {
                    // IMPORTANT: Clean up game over elements before restarting
                    if (activeScene.hideGameOverElements) {
                        activeScene.hideGameOverElements();
                        console.log('Farcade SDK: Game over elements cleaned up.');
                    }
                    activeScene.startGame();
                    console.log('Farcade SDK: Game restarted.');
                } else {
                    console.warn('Farcade SDK: Could not find active scene to restart game.');
                }
            });

            // Handle mute/unmute requests from Farcade
            window.FarcadeSDK.on('toggle_mute', (data) => {
                console.log('Farcade SDK: Mute toggle requested, isMuted:', data.isMuted);
                // Use Phaser's global sound manager to mute/unmute all audio
                game.sound.mute = data.isMuted;
                console.log('Farcade SDK: All game audio mute state set to:', data.isMuted);
            });

            console.log('Farcade SDK: Event handlers registered.');
        }`;
    });

    return modifiedHtml;
}

async function integrateFarcade() {
    console.log('Starting AESOPNE Farcade integration process...');

    let htmlContent = readFile(config.indexTemplate);
    if (!htmlContent) {
        console.error('Could not read HTML template. Aborting.');
        return;
    }

    // Step 1: Inject Farcade SDK script tag
    htmlContent = injectFarcadeSDK(htmlContent);

    // Step 2: Inject Farcade SDK game logic (ready, gameOver, play_again, toggle_mute)
    htmlContent = injectFarcadeGameLogic(htmlContent);

    writeFile(config.outputFile, htmlContent);

    console.log('AESOPNE Farcade integration complete! Output file:', config.outputFile);
    console.log('The integrated version will:');
    console.log('- Signal ready when the title screen is interactive');
    console.log('- Submit height in meters as the score on game over');
    console.log('- Handle play again requests by restarting the game');
    console.log('- Handle mute/unmute requests via Phaser sound manager');
}

// Execute the integration function
integrateFarcade();