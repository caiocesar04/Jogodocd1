/* Game JS - versão com Soco e Ladrão Atordoado/Sumindo */

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const overlayMessage = document.getElementById("overlayMessage");
const restartBtn = document.getElementById("restartBtn");
const cutsceneVideo = document.getElementById("cutsceneVideo");
// >>> Elemento de transição de tela para o efeito fade
const fadeTransition = document.getElementById("fadeTransition");

const GAME = { width: canvas.width, height: canvas.height, boxCount: 6, timeLimit: 60 };
// >>> ALTERAÇÃO: BOX_SIZE substituído por BOX_WIDTH e BOX_HEIGHT
const BOX_WIDTH = 70; // Nova Largura da Caixa
const BOX_HEIGHT = 50; // Altura mantida
const FADE_DURATION = 1500; // 1500ms = 1.5 segundos (Deve ser igual ao CSS transition-duration)

const TRUCK_CONFIG = { x: 470, y: 155, width: 600, height: 270 };

const FRAME_RATE = 60; // Assumindo 60 FPS (taxa de atualização do requestAnimationFrame)
const ROBBER_INTERVAL_SECONDS = 5; // O ladrão tentará roubar a cada 5 segundos
let robberTimer = 0; // Contador de frames para o ladrão

// NOVO: Configuração para a animação de "sumir" do ladrão
const STUN_DURATION_FRAMES = FRAME_RATE * 1.5; // Duração total do atordoamento (1.5s)
const BLINK_INTERVAL_FRAMES = 5; // Pisca a cada 5 frames (3 piscadas em 1.5s)

// --- REINTRODUZIDO: CONSTANTES PARA LARGURAS DE DESENHO (Visual) ---
const DRAW_WIDTHS = {
    // Larguras de desenho (Visual) para cada sprite:
    idle: 50,      
    idleBox: 100,  
    walk: 170,     
    walkBox: 150,  
    pick: 140,     
    lost: 140,     
    lostBox: 180, 
    // NOVO: Largura do Soco (Ajuste conforme o sprite)
    punch: 180,
    // NOVO: Largura de desenho para o ladrão (assumindo que é igual a 'walk' ou um valor customizado)
    robberWalk: 170,
    // NOVO: Largura de desenho para o ladrão com caixa (se diferente de 'walkBox' do player)
    robberWalkBox: 170 
};
// ---------------------------------------------------------------------

// Caminhos corrigidos
const assets = {
    bg: "../assets/CENÁRIO 1.png",
    truck: "../assets/caminhonete.png",
    box: "../assets/caixa.png",
    // Ladrão
    robberWalk: "../assets/walkladrao.png",
    robberWalkBox: "../assets/walkboxladrao.png", // SPRITE DO LADRÃO COM CAIXA
    player: {
        idle: "../assets/IDLE.gif",
        idleBox: "../assets/IDLEBOX.gif",
        walk: "../assets/WALK.png",
        walkBox: "../assets/WALKBOX.png",
        pick: "../assets/PICKBOX.png",
        lost: "../assets/LOST.png",
        lostBox: "../assets/LOSTBOX.png",
        // >>> ALTERAÇÃO: Ativar o sprite do Soco <<<
        punch: "../assets/PUNCH.png", 
    },
};

const images = {};
let loaded = 0;
// totalAssets: 7 sprites do player + 3 BG/Truck/Box + 2 sprites do ladrão = 12
const totalAssets = Object.keys(assets.player).length + 3 + 2;

function loadImage(src, key) {
    const img = new Image();
    img.src = src;
    img.onload = () => {
        loaded++;
        if (loaded === totalAssets) startGame();
    };
    return img;
}

images.bg = loadImage(assets.bg, 'bg');
images.truck = loadImage(assets.truck, 'truck');
images.box = loadImage(assets.box, 'box');
// Carregar os novos sprites do ladrão
images.robberWalk = loadImage(assets.robberWalk, 'robberWalk');
images.robberWalkBox = loadImage(assets.robberWalkBox, 'robberWalkBox');
for (const key in assets.player) images[key] = loadImage(assets.player[key], key);

const player = {
    x: 100,
    y: 550,
    width: 120, // Largura de COLISÃO (Bounding Box)
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

// Configuração do Ladrão (Oponente)
const robber = {
    x: -150, // Começa FORA da tela (esquerda)
    y: 550,  // Mesma altura do jogador
    width: 120,
    height: 170,
    speed: 6, // Um pouco mais rápido que o jogador (5)
    direction: "right", // Inicialmente entrando
    state: "idle",      // Será "walk" ao se mover
    frame: 0,
    frameDelay: 8,
    frameCounter: 0,
    active: false,      // Controla se o ladrão está em sua rotina
    targetBox: null,    // A caixa que ele tentará roubar
    hasBox: false,      // Se ele pegou a caixa
    // NOVO: Timer para o estado de atordoamento (stun)
    stunTimer: 0
};


const frameCounts = {
    idle: 1,
    idleBox: 1,
    walk: 8,
    walkBox: 8,
    pick: 4,
    lost: 4,
    lostBox: 5,
    punch: 4, // 4 frames para o soco
    // Conta de frames para os sprites do Ladrão
    robberWalk: 8,
    robberWalkBox: 8
};

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
            console.error("Erro ao reproduzir o vídeo (provável bloqueio de autoplay):", error);
            alert("Vitória! Redirecionando para a próxima fase...");
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
        window.location.href = "tela3.html";
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

    // NOVO: Lógica do ladrão
    handleRobber();

    boxes.forEach((b) => {
        // >>> ATUALIZADO: Desenho da caixa usa BOX_WIDTH e BOX_HEIGHT
        if (!b.collected) ctx.drawImage(images.box, b.x, b.y, BOX_WIDTH, BOX_HEIGHT);
    });

    updatePlayerAnimation();
    drawPlayer();

    // NOVO: Desenha o ladrão (e atualiza sua animação)
    if (robber.active) {
        updateRobberAnimation();
        drawRobber();
    }

    requestAnimationFrame(update);
}


// NOVO: Função para o loop de IA/Movimento do Ladrão
function handleRobber() {

    // NOVO: Lógica do Estado STUN (Atordoado, Pisca e Some)
    if (robber.state === "stun") {
        robber.stunTimer--;

        // Pisca 3 vezes (Alterna a visibilidade)
        // Usa o frame para alternar a visibilidade (par=visível, ímpar=invisível)
        if (robber.stunTimer > 0 && robber.stunTimer % BLINK_INTERVAL_FRAMES === 0) {
            robber.frame = (robber.frame + 1) % 2;
        }

        // Fim do atordoamento - O ladrão some
        if (robber.stunTimer <= 0) {
            robber.active = false;
            robber.state = "idle";
            robber.x = -150;
            // Garante que o ladrão está invisível ao sumir
            robber.frame = 0;
        }

        return; // Retorna para que o ladrão não se mova enquanto atordoado
    }

    // 1. Contador de Tempo para Iniciar a Rotina de Roubo
    if (!robber.active) {
        robberTimer++;

        // Verifica o intervalo.
        if (robberTimer >= FRAME_RATE * ROBBER_INTERVAL_SECONDS) {
            robberTimer = 0;

            // Tenta selecionar uma caixa aleatória não coletada para roubar
            const availableBoxes = boxes.filter(b => !b.collected);
            if (availableBoxes.length > 0) {
                // Seleciona a primeira caixa disponível (pode ser aleatório)
                robber.targetBox = availableBoxes[0];
                robber.active = true;
                robber.state = "walk";
                robber.direction = "right"; // Entrando
                robber.x = -150; // Reseta a posição inicial (fora da tela)
                robber.hasBox = false;
                robber.frame = 0;
            }
        }
        return;
    }

    // O ladrão está ativo - Executa a rotina

    // Estágio 1: Mover para o alvo (targetBox)
    if (robber.targetBox && !robber.hasBox) {
        // Para simplificar, o alvo é apenas a posição X da caixa
        const targetX = robber.targetBox.x;

        // Move horizontalmente (semelhante ao jogador)
        if (robber.x < targetX) {
            robber.x += robber.speed;
        } else if (robber.x > targetX) {
            robber.x -= robber.speed;
        }

        // Se chegou perto da caixa (dentro de uma margem de colisão)
        if (Math.abs(robber.x - targetX) < 10) {

            // Se o jogador não a pegou antes
            if (!robber.targetBox.collected) {
                robber.targetBox.collected = true; // Caixa roubada!
                robber.hasBox = true;
                
                // Usa o estado de caminhada com caixa do ladrão para fugir
                robber.state = "robberWalkBox"; 
                
                robber.direction = "left"; // Vira para fugir
                robber.frame = 0;
            } else {
                // A caixa foi pega pelo jogador antes que o ladrão chegasse
                robber.active = false; // Cancela a rotina do ladrão
                robber.targetBox = null;
                robber.x = -150; // Teleporta de volta para fora da tela
            }
        }
    }
    // Estágio 2: Fuga (Voltar para a esquerda)
    else if (robber.hasBox) {
        // Garante que está no estado de fuga com caixa
        robber.state = "robberWalkBox"; 
        robber.x -= robber.speed;

        // Se saiu da tela
        if (robber.x < -150) {
            robber.active = false;
            robber.targetBox = null;
            robber.hasBox = false;
        }
    }
}


// === Movimento, Coleta e Soco ===
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
        // >>> ATUALIZADO: Colisão da caixa usa BOX_WIDTH e BOX_HEIGHT
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

    // NOVO: Adiciona Soco com a tecla B
    if (keys["b"] || keys["B"]&& !player.busy) {
        player.state = "punch";
        player.frame = 0;
        player.frameCounter = 0;
        player.busy = true;

        // Limpa o estado da tecla para não disparar a cada frame
        keys["B"] = false;
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

// NOVO: Função para verificar se o soco atingiu o ladrão
function checkRobberHit() {
    // Verifica se o ladrão está ativo, tem a caixa, e não está atordoado
    if (!robber.active || !robber.hasBox || robber.state === "stun") return;

    // A. Define a área de colisão do Soco
    const PUNCH_WIDTH = 100;
    const punchZone = {
        // Posição ajustada para a frente do jogador
        x: player.direction === "right"
            ? player.x + player.width / 2 - PUNCH_WIDTH / 2 + 50 // Soco para a direita
            : player.x + player.width / 2 - PUNCH_WIDTH / 2 - 50, // Soco para a esquerda
        y: player.y,
        width: PUNCH_WIDTH, // Largura da zona de soco
        height: player.height // Altura total
    };

    // B. Usa a colisão
    if (collide(punchZone, robber, robber.width, robber.height)) {

        // 1. Ladrão Solta a Caixa
        if (robber.targetBox) {
            // Re-ativa a caixa na posição onde o ladrão foi atingido
            robber.targetBox.collected = false;
            // Posiciona a caixa um pouco atrás do ladrão (ajustado para a direção)
            robber.targetBox.x = robber.x + (robber.direction === "right" ? robber.width : -BOX_WIDTH);
            robber.targetBox.y = robber.y + robber.height - BOX_HEIGHT;
        }

        // 2. Inicia o Estado de Piscar e Sumir
        robber.hasBox = false;
        robber.targetBox = null;
        robber.state = "stun"; // Novo estado de atordoamento
        robber.stunTimer = STUN_DURATION_FRAMES; // Começa o cronômetro
        robber.frame = 0; // Usado para contagem do piscar
    }
}


// === Colisão restrita à lateral esquerda da caminhonete ===
function checkTruckDelivery() {
    // 1. Define a área de colisão da "caçamba esquerda"
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

// === Animação (Inverte a ordem dos frames de 'walk' e 'walkBox' e adiciona 'punch') ===
function updatePlayerAnimation() {
    const key = getSpriteKey(player);
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

            // NOVO: Lógica do Soco
            if (player.state === "punch") {
                // Supondo que o frame de contato seja o frame 2 de 4 frames
                if (player.frame === 2) {
                    checkRobberHit(); // Checa colisão no frame de impacto
                }

                // Se o soco terminou, volta ao estado idle e libera o busy
                if (player.frame === frames - 1) {
                    player.busy = false;
                    player.state = player.hasBox ? "idleBox" : "idle"; // Volta para idle, com ou sem caixa
                    player.frame = 0;
                    player.frameCounter = 0;
                }
            }
        }
    }
}

// NOVO: Lógica de Animação do Ladrão
function updateRobberAnimation() {
    // Se estiver atordoado (stun), a lógica é controlada por handleRobber
    if (robber.state === "stun") return;

    // O ladrão usa a mesma lógica de frames, mas com o objeto 'robber'
    const key = getSpriteKey(robber);
    const frames = frameCounts[key] || 1;
    robber.frameCounter++;

    if (robber.frameCounter >= robber.frameDelay) {
        robber.frameCounter = 0;

        // Animação de andar do ladrão
        if (key === "robberWalk" || key === "robberWalkBox") {
            robber.frame = (robber.frame - 1 + frames) % frames;
        } else {
            robber.frame = (robber.frame + 1) % frames;
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

// Função utilitária para pegar a chave do sprite, serve para player e robber
function getSpriteKey(entity) {
    // Player - Fim de Jogo
    if (entity === player && gameOver) return entity.hasBox ? "lostBox" : "lost";

    // Player - Soco
    if (entity.state === "punch") return "punch";

    // Lógica Específica do Ladrão
    if (entity === robber) {
        // Ladrão Atordoado (stun) usa o sprite base de caminhada (ou outro)
        if (entity.state === "stun") return "robberWalk";

        // Ladrão caminhando (indo para o alvo - sem caixa)
        if (entity.state === "walk") {
            return "robberWalk";
        }
        // Ladrão caminhando COM caixa (fugindo)
        if (entity.state === "robberWalkBox") {
            return "robberWalkBox";
        }
        // Caso de fallback (se o ladrão estiver em idle, mas ativo)
        return "robberWalk";
    }

    // Lógica do Player (Normal)
    switch (entity.state) {
        case "walk":
            // CORREÇÃO: Usa 'walkBox' se player.hasBox for verdadeiro.
            return entity.hasBox ? "walkBox" : "walk"; 
        case "pick":
            return "pick";
        default:
            // idle, idleBox
            return entity.hasBox ? "idleBox" : "idle";
    }
}

// === Desenho e Correção de Alinhamento do Player ===
function drawPlayer() {
    drawEntity(player);
}

// NOVO: Função para desenhar o Ladrão (chama a mesma função utilitária)
function drawRobber() {
    drawEntity(robber);
}

// Função utilitária para desenhar o Player/Robber
function drawEntity(entity) {
    const key = getSpriteKey(entity);
    const sprite = images[key];

    // Se o sprite não foi carregado, não desenha (evita erros)
    if (!sprite) {
        // console.warn(`Sprite not found for key: ${key}`);
        return;
    }

    const frames = frameCounts[key] || 1;
    const frameWidth = sprite.width / frames;

    // NOVO: Lógica de Piscar para o Ladrão Atordoado
    if (entity === robber && entity.state === "stun") {
        // Se frame === 1 (ímpar), não desenha, simulando um piscar invisível.
        if (entity.frame === 1) return;
    }

    // Coordenadas fixas e inteiras
    const displayX = Math.floor(entity.x);
    const displayY = Math.floor(entity.y);

    // 1. Obtém a largura de desenho (Visual) baseada no estado atual
    let drawWidth = DRAW_WIDTHS[key] || entity.width;

    const drawHeight = entity.height;

    // 2. Calcula a diferença de largura para manter o centro do personagem fixo
    const widthAdjustment = (entity.width - drawWidth) / 2;

    const cx = displayX + entity.width / 2;
    const cy = displayY + entity.height / 2;

    // Ajusta o dx com base na nova largura para manter a centralização
    const dx = Math.floor(-drawWidth / 2) + widthAdjustment;
    const dy = Math.floor(-drawHeight / 2);

    // Offset para corrigir sprites idle desalinhados (mantido)
    const offsetY = key === "idle" || key === "idleBox" ? -4 : 0;

    ctx.save();
    ctx.translate(cx, cy);

    const facingRight = entity.direction === "right";
    // Flip horizontal corrigido
    if (facingRight) ctx.scale(-1, 1);

    ctx.drawImage(
        sprite,
        frameWidth * entity.frame,
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
    // Força um update para desenhar a animação "lost"
    requestAnimationFrame(update);

    if (win) {
        overlayMessage.textContent = "🎉 Você venceu! Próxima Fase!";
        restartBtn.textContent = "Continuar";
    } else {
        overlayMessage.textContent = "⏰ Tempo esgotado!";
        restartBtn.textContent = "Reiniciar";
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
    gameOver = false; // Resetar gameOver para rodar update novamente
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

    // NOVO: Reseta o estado do ladrão
    robber.active = false;
    robber.x = -150;
    robber.targetBox = null;
    robber.hasBox = false;
    robberTimer = 0;
    robber.state = "idle";
    robber.stunTimer = 0;

    document.getElementById("score").textContent = `📦 ${score}/${GAME.boxCount}`;
    startGame();
}

document.addEventListener('DOMContentLoaded', () => {
    // Isso garante que o jogo comece se todos os assets já tiverem sido carregados
    if (loaded === totalAssets) {
        startGame();
    }
});