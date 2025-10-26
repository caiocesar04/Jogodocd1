/* Game JS - versão corrigida final:
 * - Adiciona lógica de "Continuar" após vitória e redirecionamento para tela2.html
 * - NOVIDADE: A caixa some imediatamente ao pressionar "Espaço" (início da animação 'pick').
 * - NOVIDADE: A ordem dos frames da animação 'walk' (andando) é revertida.
 * - Corrige bug de "idle pulando" (frames desalinhados)
 * - Mantém personagem centralizado no mesmo ponto em todos os frames
 * - Usa coordenadas inteiras para evitar tremidas
 * - Offset automático aplicado apenas em idle/idleBox
 * - Flip horizontal corrigido (sprites viram corretamente)
 * - NOVIDADE: Lógica para rodar uma Cutscene em vídeo (CUTSCENE1.mp4) antes do redirecionamento com transição (fade).
 * - NOVIDADE: Colisão de entrega restrita à lateral esquerda da caminhonete.
 * - ALTERAÇÃO SOLICITADA: Ajuste na função drawPlayer para MUDAR A LARGURA de TODOS os estados (idle, walk, pick, lost) SEPARADAMENTE da largura de COLISÃO (player.width), mantendo o centro.
 * - **ALTERAÇÃO SOLICITADA AGORA:** A LARGURA da caixa (BOX_WIDTH) foi alterada para 70 pixels, enquanto a altura é mantida em 50 pixels.
 */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayMessage = document.getElementById("overlayMessage");
const restartBtn = document.getElementById("restartBtn"); 
const cutsceneVideo = document.getElementById("cutsceneVideo");
// >>> Elemento de transição de tela para o efeito fade
const fadeTransition = document.getElementById("fadeTransition"); 

const GAME = { width: canvas.width, height: canvas.height, boxCount: 6, timeLimit: 60 };
// A constante original BOX_SIZE é agora a LARGURA da caixa.
const BOX_WIDTH = 70; // <<<<<<< ALTERAÇÃO: Nova Largura da Caixa
// Adicionando uma nova constante para a altura.
const BOX_HEIGHT = 50; // <<<<<<< NOVA CONSTANTE: Altura Original (50)
const FADE_DURATION = 1500; // 1500ms = 1.5 segundos (Deve ser igual ao CSS transition-duration)

const TRUCK_CONFIG = { x: 470, y: 155, width: 600, height: 270 };

// --- NOVAS CONSTANTES PARA LARGURAS DE DESENHO (Visual) ---
const DRAW_WIDTHS = {
    // Larguras de desenho (Visual) para cada sprite:
    idle: 50,       
    idleBox: 100,  
    walk: 170,     
    walkBox: 150,  
    pick: 140,     
    lost: 140,     
    lostBox: 180   
};
// -----------------------------------------------------------


// Caminhos corrigidos
const assets = {
    bg: "../assets/CENÁRIO 1.png",
    truck: "../assets/caminhonete.png",
    box: "../assets/caixa.png",
    player: {
        idle: "../assets/IDLE.gif",
        idleBox: "../assets/IDLEBOX.gif",
        walk: "../assets/WALK.png",
        walkBox: "../assets/WALKBOX.png",
        pick: "../assets/PICKBOX.png",
        lost: "../assets/LOST.png",
        lostBox: "../assets/LOSTBOX.png",
    },
};

const images = {};
let loaded = 0;
const totalAssets = Object.keys(assets.player).length + 3;

function loadImage(src) {
    const img = new Image();
    img.src = src;
    img.onload = () => {
        loaded++;
        if (loaded === totalAssets) startGame();
    };
    return img;
}

images.bg = loadImage(assets.bg);
images.truck = loadImage(assets.truck);
images.box = loadImage(assets.box);
for (const key in assets.player) images[key] = loadImage(assets.player[key]);

const player = {
    x: 100,
    y: 550,
    // ALTERAÇÃO: Largura de COLISÃO (Player Bounding Box)
    width: 120, 
    height: 170,
    speed: 5,
    hasBox: false,
    direction: "right",
    frame: 0,
    frameDelay: 8,
    frameCounter: 0,
    state: "idle",
    busy: false,
};

const frameCounts = { idle: 1, idleBox: 1, walk: 8, walkBox: 8, pick: 4, lost: 4, lostBox: 5 };

let boxes = Array.from({ length: GAME.boxCount }, (_, i) => ({
    x: 120 + (i % 3) * 260,
    y: 540 + Math.floor(i / 3) * 30,
    collected: false,
}));
const truck = {
    x: TRUCK_CONFIG.x,
    y: TRUCK_CONFIG.y,
    width: TRUCK_CONFIG.width,
    height: TRUCK_CONFIG.height,
};

const keys = {};
window.addEventListener("keydown", (e) => {
    if (e.key === " ") e.preventDefault();
    keys[e.key] = true;
});
window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
});

let timeLeft = GAME.timeLimit,
    score = 0,
    gameOver = false,
    // Estado para pausar o jogo durante o vídeo
    videoPlaying = false,
    timerInterval;

// === Lógica de Reprodução e Redirecionamento do Vídeo com Transição ===
function playCutscene() {
    if (!fadeTransition || !cutsceneVideo) {
        console.error("Erro: Elementos de transição ou vídeo não encontrados. Redirecionando...");
        window.location.href = "tela2.html";
        return;
    }

    // 1. Oculta o overlay de texto/botão
    overlay.classList.add("hidden");
    
    // 2. ACIONA O FADE-OUT: Escurece a tela
    fadeTransition.classList.add("active");
    videoPlaying = true;
    
    // 3. Espera a transição de escurecimento terminar (1.5 segundos)
    setTimeout(() => {
        // Se a tela estiver escura, podemos iniciar o vídeo
        cutsceneVideo.style.display = "block";
        
        cutsceneVideo.play().catch(error => {
            // Em caso de falha de autoplay (comum em navegadores), exibe a transição de volta
            console.error("Erro ao reproduzir o vídeo (provável bloqueio de autoplay):", error);
            alert("Vitória! Redirecionando para a próxima fase...");
            // Garante que a tela clareie e redirecione
            finishCutsceneAndRedirect();
        });

        // 4. ACIONA O FADE-IN: Clareia a tela sobre o vídeo
        fadeTransition.classList.remove("active");

        // 5. Adiciona um Listener para o evento 'ended' (fim do vídeo)
        cutsceneVideo.onended = finishCutsceneAndRedirect;
        
    }, FADE_DURATION); // Espera 1.5 segundos
}

function finishCutsceneAndRedirect() {
    if (!fadeTransition) {
        window.location.href = "tela2.html";
        return;
    }

    // 1. ACIONA O FADE-OUT NOVAMENTE para escurecer antes de redirecionar
    fadeTransition.classList.add("active");

    // 2. Espera o fade-out (1.5 segundos) e então redireciona
    setTimeout(() => {
        cutsceneVideo.style.display = "none";
        videoPlaying = false;
        // 3. Redireciona para a próxima fase
        window.location.href = "tela2.html";
    }, FADE_DURATION);
}


// === Ação do botão é determinada pelo estado do jogo ===
restartBtn.addEventListener("click", () => {
    if (restartBtn.textContent === "Continuar" && gameOver) {
        playCutscene();
    } else {
        resetGame();
    }
});
// ===================================================================

function startGame() {
    document.getElementById("timer").textContent = `⏱ ${timeLeft}`;
    document.getElementById("score").textContent = `📦 ${score}/${GAME.boxCount}`;
    timerInterval = setInterval(() => {
        // Não atualiza o tempo se o jogo acabou ou se o vídeo está rodando
        if (!gameOver && !videoPlaying) { 
            timeLeft--;
            document.getElementById("timer").textContent = `⏱ ${timeLeft}`;
            if (timeLeft <= 0) endGame(false);
        }
    }, 1000);
    requestAnimationFrame(update);
}

function update() {
    // Se o jogo acabou ou o vídeo está tocando, paramos de desenhar o jogo normal
    if (gameOver || videoPlaying) {
        return; 
    }
    
    ctx.clearRect(0, 0, GAME.width, GAME.height);
    ctx.drawImage(images.bg, 0, 0, GAME.width, GAME.height);
    ctx.drawImage(images.truck, truck.x, truck.y, truck.width, truck.height);
    handleMovement();
    boxes.forEach((b) => {
        // ATUALIZADO: Usando BOX_WIDTH e BOX_HEIGHT
        if (!b.collected) ctx.drawImage(images.box, b.x, b.y, BOX_WIDTH, BOX_HEIGHT); 
    });
    updatePlayerAnimation();
    drawPlayer();
    
    requestAnimationFrame(update);
}

// === Movimento e Coleta (Caixa some imediatamente) ===
function handleMovement() {
    // Bloqueia movimento se ocupado, jogo acabou ou vídeo rodando
    if (player.busy || gameOver || videoPlaying) return;
    
    let moving = false;
    const prevState = player.state;

    if (keys["ArrowLeft"] || keys["a"]) {
        player.x -= player.speed;
        player.direction = "left";
        moving = true;
    }
    if (keys["ArrowRight"] || keys["d"]) {
        player.x += player.speed;
        player.direction = "right";
        moving = true;
    }
    if (keys["ArrowUp"] || keys["w"]) {
        player.y -= player.speed;
        moving = true;
    }
    if (keys["ArrowDown"] || keys["s"]) {
        player.y += player.speed;
        moving = true;
    }

    // Limites da tela/mapa
    player.x = Math.max(0, Math.min(GAME.width - player.width, player.x));
    player.y = Math.max(150, Math.min(GAME.height - player.height, player.y));

    if (moving) player.state = "walk";
    else player.state = "idle";

    if (prevState !== player.state) {
        player.frame = 0;
        player.frameCounter = 0;
    }

    // SPACE to pick box
    if ((keys[" "] || keys["Spacebar"]) && !player.hasBox && !player.busy) {
        // ATUALIZADO: Colisão usa BOX_WIDTH e BOX_HEIGHT
        const b = boxes.find((box) => !box.collected && collide(player, box, BOX_WIDTH, BOX_HEIGHT));
        if (b) {
            player.state = "pick";
            player.frame = 0;
            player.frameCounter = 0;
            player.busy = true;
            player._pickingBox = b;
            
            // A caixa é marcada como coletada AQUI, para sumir imediatamente
            b.collected = true; 
        }
    }

    if (player.hasBox) checkTruckDelivery();
}

function collide(entity, box, bw, bh) {
    return (
        entity.x + entity.width > box.x &&
        entity.x < box.x + bw &&
        entity.y + entity.height > box.y &&
        entity.y < box.y + bh
    );
}

// === Colisão restrita à lateral esquerda da caminhonete ===
function checkTruckDelivery() {
    // 1. Define a área de colisão da "caçamba esquerda"
    // Valores ajustados para a área lateral esquerda da caminhonete
    const DELIVERY_ZONE = {
        // Começa onde a caminhonete começa + um pequeno offset
        x: truck.x + 50, 
        // A largura da área de entrega (por exemplo, 20% da largura total do caminhão)
        width: truck.width * 0.20, 
        // Altura vertical da caçamba
        y: truck.y + 100,
        height: truck.height * 0.40, 
    };

    // 2. Verifica a colisão com essa nova área
    if (collide(player, DELIVERY_ZONE, DELIVERY_ZONE.width, DELIVERY_ZONE.height)) {
        score++;
        document.getElementById("score").textContent = `📦 ${score}/${GAME.boxCount}`;
        player.hasBox = false;
        if (score >= GAME.boxCount) endGame(true);
    }
}
// ====================================================================

// === Animação (Inverte a ordem dos frames de 'walk' e 'walkBox') ===
function updatePlayerAnimation() {
    const key = getSpriteKey();
    const frames = frameCounts[key] || 1;
    player.frameCounter++;
    
    if (player.frameCounter >= player.frameDelay) {
        player.frameCounter = 0;

        // Se for animação de andar, inverte a direção
        if (key === "walk" || key === "walkBox") {
            // (player.frame - 1 + frames) % frames garante que o módulo funcione corretamente para números negativos
            player.frame = (player.frame - 1 + frames) % frames;
        } else {
            // Para as demais animações, mantém a ordem normal (crescente)
            player.frame = (player.frame + 1) % frames;
            
            if (player.state === "pick" && player.frame === frames - 1) {
                finishPick();
            }
        }
    }
}

function finishPick() {
    if (player._pickingBox) {
        player.hasBox = true;
        delete player._pickingBox;
    }
    player.busy = false;
    player.state = "idle";
    player.frame = 0;
    player.frameCounter = 0;
    document.getElementById("score").textContent = `📦 ${score}/${GAME.boxCount}`;
}

function getSpriteKey() {
    if (gameOver) return player.hasBox ? "lostBox" : "lost";
    switch (player.state) {
        case "walk":
            return player.hasBox ? "walkBox" : "walk";
        case "pick":
            return "pick";
        default:
            return player.hasBox ? "idleBox" : "idle";
    }
}

// === Desenho e Correção de Alinhamento (Largura Dinâmica vs. Largura de Colisão) ===
function drawPlayer() {
    const key = getSpriteKey();
    const sprite = images[key];
    const frames = frameCounts[key] || 1;
    const frameWidth = sprite.width / frames;

    // Coordenadas fixas e inteiras
    const displayX = Math.floor(player.x);
    const displayY = Math.floor(player.y);

    // *****************************************************************
    // CÓDIGO DE ALTERAÇÃO DE LARGURA SEPARADA PARA CADA ESTADO
    
    // 1. Obtém a largura de desenho (Visual) baseada no estado atual
    let drawWidth = DRAW_WIDTHS[key] || player.width; 

    const drawHeight = player.height; 
    
    // 2. Calcula a diferença de largura para manter o centro do personagem fixo
    // Usa a largura de COLISÃO (player.width = 120) como referência central
    const widthAdjustment = (player.width - drawWidth) / 2;
    // *****************************************************************

    // Centro do Bounding Box (Colisão)
    const cx = displayX + player.width / 2;
    const cy = displayY + player.height / 2;

    // Ajusta o dx com base na nova largura para manter a centralização
    // A posição de desenho deve ser movida pelo (metade da largura de colisão - metade da largura de desenho)
    const dx = Math.floor(-drawWidth / 2) + widthAdjustment; 
    const dy = Math.floor(-drawHeight / 2);

    // Offset para corrigir sprites idle desalinhados (mantido)
    const offsetY = key === "idle" || key === "idleBox" ? -4 : 0;

    ctx.save();
    ctx.translate(cx, cy);

    const facingRight = player.direction === "right";
    // Flip horizontal corrigido
    if (facingRight) ctx.scale(-1, 1); 

    ctx.drawImage(
        sprite,
        frameWidth * player.frame,
        0,
        frameWidth,
        sprite.height,
        dx, // Usando o dx ajustado
        dy + offsetY,
        drawWidth, // Usando a largura dinâmica
        drawHeight // Usando a altura padrão
    );

    ctx.restore();
}
// =======================================================

// === Lógica de Fim de Jogo e Reset ===
function endGame(win) {
    clearInterval(timerInterval);
    gameOver = true;
    player.state = "lost";
    // Atualiza o estado "lost" uma última vez
    updatePlayerAnimation(); 
    drawPlayer();

    if (win) {
        overlayMessage.textContent = "🎉 Você venceu! Próxima Fase!";
        restartBtn.textContent = "Continuar"; 
        // Interrompe o loop de animação normal
        // O `playCutscene` será chamado pelo clique em "Continuar"
    } else {
        overlayMessage.textContent = "⏰ Tempo esgotado!";
        restartBtn.textContent = "Reiniciar"; 
        // Se perder, continua o loop para animar o "lost"
        requestAnimationFrame(update);
    }

    overlay.classList.remove("hidden");
}

function resetGame() {
    overlay.classList.add("hidden");
    restartBtn.textContent = "Reiniciar"; 
    
    // Reinicia o estado do vídeo e remove a máscara de fade
    if (cutsceneVideo) {
        cutsceneVideo.style.display = "none";
        cutsceneVideo.pause();
        cutsceneVideo.currentTime = 0;
    }
    if (fadeTransition) {
        fadeTransition.classList.remove("active");
    }
    
    videoPlaying = false;
    
    timeLeft = GAME.timeLimit;
    score = 0;
    gameOver = false;
    boxes = Array.from({ length: GAME.boxCount }, (_, i) => ({
        x: 120 + (i % 3) * 260,
        y: 540 + Math.floor(i / 3) * 30,
        collected: false,
    }));
    player.x = 100;
    player.y = 550;
    player.hasBox = false;
    player.state = "idle";
    player.busy = false;
    player.frame = 0;
    document.getElementById("score").textContent = `📦 ${score}/${GAME.boxCount}`;
    startGame();
}