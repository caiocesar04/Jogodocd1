/* Game JS - versão corrigida final:
 * - Adiciona lógica de "Continuar" após vitória e redirecionamento para tela2.html
 * - NOVIDADE: Oponente (Ladrão) que rouba caixas da esquerda para a esquerda.
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
 * - ALTERAÇÃO: Ajuste na função drawPlayer para MUDAR A LARGURA de idle E idleBox SEPARADAMENTE (mantendo o centro).
 * - **CORREÇÃO FINAL:** Largura da caixa (BOX_WIDTH) alterada para 70px e altura (BOX_HEIGHT) mantida em 50px.
 * - **CORREÇÃO FINAL:** Reintrodução da constante DRAW_WIDTHS para controle de largura visual do jogador/ladrão em todos os estados.
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
// >>> ALTERAÇÃO: BOX_SIZE substituído por BOX_WIDTH e BOX_HEIGHT
const BOX_WIDTH = 70; // Nova Largura da Caixa
const BOX_HEIGHT = 50; // Altura mantida
const FADE_DURATION = 1500; // 1500ms = 1.5 segundos (Deve ser igual ao CSS transition-duration)

const TRUCK_CONFIG = { x: 470, y: 155, width: 600, height: 270 };

const FRAME_RATE = 60; // Assumindo 60 FPS (taxa de atualização do requestAnimationFrame)
const ROBBER_INTERVAL_SECONDS = 5; // O ladrão tentará roubar a cada 5 segundos
let robberTimer = 0; // Contador de frames para o ladrão

// --- REINTRODUZIDO: CONSTANTES PARA LARGURAS DE DESENHO (Visual) ---
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
// ---------------------------------------------------------------------

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

// NOVO: Configuração do Ladrão (Oponente)
const robber = {
    x: -150, // Começa FORA da tela (esquerda)
    y: 550,  // Mesma altura do jogador
    width: 120, 
    height: 170,
    speed: 6, // Um pouco mais rápido que o jogador (5)
    direction: "right", // Inicialmente entrando
    state: "idle",      // Será "walk" ao se mover
    frame: 0,
    frameDelay: 8,
    frameCounter: 0,
    active: false,      // Controla se o ladrão está em sua rotina
    targetBox: null,    // A caixa que ele tentará roubar
    hasBox: false,      // Se ele pegou a caixa
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
        // Ação de vitória: Redireciona para tela2.html (como estava antes)
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
        // Ação de vitória: Redireciona para tela2.html (como estava antes)
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
        // ************************************************
        // ALTERAÇÃO PARA TELA3.HTML APÓS VENCER O JOGO
        // ************************************************
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
                robber.state = "idleBox"; // Ladrão pega a caixa
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
        robber.state = "walkBox"; // Estado de fuga (andando com caixa)
        robber.x -= robber.speed;
        
        // Se saiu da tela
        if (robber.x < -150) {
            robber.active = false;
            robber.targetBox = null;
            robber.hasBox = false;
        }
    }
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
        }
    }
}

// NOVO: Lógica de Animação do Ladrão
function updateRobberAnimation() {
    // O ladrão usa a mesma lógica de frames, mas com o objeto 'robber'
    const key = getSpriteKey(robber);
    const frames = frameCounts[key] || 1; 
    robber.frameCounter++;
    
    if (robber.frameCounter >= robber.frameDelay) {
        robber.frameCounter = 0;

        // Se for animação de andar
        if (key === "walk" || key === "walkBox") {
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
    // Nota: A verificação de entity.gameOver só deve ser feita se a entidade for o player (que é o que está sendo verificado na função endGame original)
    if (entity === player && gameOver) return entity.hasBox ? "lostBox" : "lost"; 
    switch (entity.state) {
        case "walk":
        case "walkBox": // Ladrão pode ter walkbox no estado de fuga
            return entity.hasBox ? "walkBox" : "walk";
        case "pick":
            return "pick";
        default:
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
    const frames = frameCounts[key] || 1;
    const frameWidth = sprite.width / frames;

    // Coordenadas fixas e inteiras
    const displayX = Math.floor(entity.x);
    const displayY = Math.floor(entity.y);

    // *****************************************************************
    // CORREÇÃO: Usa a constante DRAW_WIDTHS para obter a largura de desenho
    
    // 1. Obtém a largura de desenho (Visual) baseada no estado atual
    // Se o estado não estiver em DRAW_WIDTHS (ex: um estado temporário), usa a largura de colisão padrão (120)
    let drawWidth = DRAW_WIDTHS[key] || entity.width; 

    const drawHeight = entity.height; 
    
    // 2. Calcula a diferença de largura para manter o centro do personagem fixo
    // Usa a largura de COLISÃO (entity.width = 120) como referência central
    const widthAdjustment = (entity.width - drawWidth) / 2;
    // *****************************************************************

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
    // O `requestAnimationFrame` será interrompido na próxima chamada de `update`
    // Mas precisamos rodar o loop pelo menos mais uma vez para animar o "lost"
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

    // NOVO: Reseta o estado do ladrão
    robber.active = false;
    robber.x = -150;
    robber.targetBox = null;
    robber.hasBox = false;
    robberTimer = 0;
    
    document.getElementById("score").textContent = `📦 ${score}/${GAME.boxCount}`;
    startGame();
}

document.addEventListener('DOMContentLoaded', () => {
    // Isso garante que o jogo comece se todos os assets já tiverem sido carregados
    if (loaded === totalAssets) {
        startGame();
    }
});