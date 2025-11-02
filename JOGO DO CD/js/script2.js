// ====================================================================
// Jogo do CD - Script principal (script2.js) 
// ====================================================================

// ============== 1. Variáveis Globais de Jogo (Movimento & Colisão) ==============

// Variáveis da Caminhonete (Player)
let caminhoneteElement;
let currentLeft = 70; // Posição inicial horizontal: 50% (centro) + 20% = 70%
let currentBottom = 50; // Posição inicial vertical: 0px + 5% mais para cima (ajustado para 50px)

// Variáveis dos Carros (Inimigos - Faixa Direita - DESCENDO AGORA)
let carro1Element, carro2Element, carro3Element;
const CAR_SPEED = 9.5; // Velocidade de DESCIDA dos carros em pixels por frame (Aumentada)

// NOVAS Variáveis dos Carros (Inimigos - Faixa Esquerda - Descendo)
let carro4Element, carro5Element, carro6Element;
const CAR_SPEED_REVERSE = 19; // Velocidade de descida dos carros (contramão)

let carPositions = {
    carro1: 1000, // Posição inicial ALTA para começar a descer
    carro2: 1400, // Posição inicial ALTA para começar a descer
    carro3: 1800, // Posição inicial ALTA para começar a descer
    // Novas posições
    carro4: 1000,
    carro5: 1400,
    carro6: 1800
};

// Variável para controlar o loop do jogo (necessária para parar o jogo)
let gameLoopInterval;

// Variável de Estado de Jogo
let isGameOver = false;

// NOVO: Variáveis para os Colisores de Canteiro/Faixa
let colisor1Element;
let colisor2Element;
let colisor3Element; 

// NOVO: Variáveis para o Efeito Parallax de Fundo
let gameBoardElement; // Referência ao <div> do game board
let backgroundPositionY = 0; // Posição vertical do fundo (em pixels)
// Fator de velocidade para o fundo. Ajuste se a pista parecer muito lenta/rápida.
const BACKGROUND_SCROLL_FACTOR = 1.5; 
const BACKGROUND_RESET_HEIGHT = 10000; 

// NOVO: Mapa para rastrear o estado de cada tecla pressionada
const keysPressed = {};
const HORIZONTAL_UNIT = 1; // Movimento horizontal em %

// CONSTANTES PARA A SENSAÇÃO DE RÉ
const VERTICAL_UNIT_FORWARD = 15; // Velocidade máxima para CIMA
const VERTICAL_UNIT_BACKWARD = 8; // Velocidade REDUZIDA para BAIXO (Ré)
const HORIZONTAL_SLOW_FACTOR = 0.5; // Fator de redução horizontal na "Ré"

// NOVO: Limite para detecção da contramão
const CONTRARIO_FAILURE_THRESHOLD = 40; 

// ====================================================================
// >>> NOVAS VARIÁVEIS PARA A LOJA
// ====================================================================
let lojaElement; // Referência ao elemento <img> da loja
const INITIAL_LOJA_POSITION = 850; // Posição 'bottom' que corresponde ao top: -50px no CSS (800px da tela + 50px de margem)
const LOJA_SPEED = CAR_SPEED_REVERSE; // Velocidade de descida da loja
// ====================================================================


// ====================================================================
// ============== Variáveis e Funções do Cronômetro ==============
// ====================================================================
let timerElement;
let countdownInterval;
const TOTAL_TIME_SECONDS = 10; // 1 minuto
let timeLeft = TOTAL_TIME_SECONDS;

// Variáveis do Overlay
let overlayElement;
let overlayMessage;
let restartBtn;


// Função para formatar o tempo (MM:SS)
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 10);
    const remainingSeconds = seconds % 10;
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(remainingSeconds).padStart(2, '0');
    return `${formattedMinutes}:${formattedSeconds}`;
}

// Função para atualizar o cronômetro
function updateTimer() {
    if (isGameOver) {
        clearInterval(countdownInterval);
        return;
    }

    if (timerElement) {
        timerElement.textContent = formatTime(timeLeft);
    }
    
    // =================================================================
    // >>> LÓGICA DE MUDANÇA DE ESTRADA (2 SEGUNDOS FALTANDO)
    // =================================================================
    if (timeLeft === 2) {
        if (gameBoardElement) {
            // Se você tem uma 'estrada2.png', descomente esta linha
            // gameBoardElement.style.backgroundImage = 'url("estrada2.png")'; 
            console.log("MUDANÇA DE FASE (simulada): Próxima fase em 2 segundos!");
        }
    }
    
    // =================================================================
    // >>> NOVO: ATIVAÇÃO DA LOJA (1 SEGUNDO FALTANDO)
    // =================================================================
    if (timeLeft === 1) {
        if (lojaElement) {
            // 1. Torna o elemento visível
            lojaElement.style.visibility = 'visible';
            lojaElement.style.opacity = '1';
            
            // 2. Define o ponto de partida vertical (usando a constante)
            lojaElement.style.bottom = `${INITIAL_LOJA_POSITION}px`;
            lojaElement.setAttribute('data-loja-position', INITIAL_LOJA_POSITION);
            
            console.log("CHEGADA: Loja ativada e começando a descer!");
        }
    }
    // =================================================================

    // === Condição de Vitória (Tempo Esgotado) ===
    if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        winGame(); // <--- CHAMA A FUNÇÃO DE VITÓRIA
        return;
    }

    timeLeft--;
}

// ====================================================================
// ============== FIM: Variáveis e Funções do Cronômetro ==============
// ====================================================================


// ====================================================================
// ============== 2. Funções de Movimento do Player (Caminhonete) ==============
// ====================================================================

// Função Principal que aplica o movimento e verifica limites
function moveCaminhonete(deltaX, deltaY) {
    if (!caminhoneteElement || isGameOver) return;

    // --- Movimento Horizontal (Eixo X) ---
    currentLeft += deltaX;

    // Limitar o movimento entre 0% e 100%
    if (currentLeft < 0) {
        currentLeft = 0;
    } else if (currentLeft > 100) {
        currentLeft = 100;
    }

    // --- Movimento Vertical (Eixo Y) ---
    currentBottom += deltaY;

    // Limitar o movimento vertical
    const MAX_BOTTOM = 300;
    if (currentBottom < 0) {
        currentBottom = 0;
    } else if (currentBottom > MAX_BOTTOM) {
        currentBottom = MAX_BOTTOM;
    }

    // Aplica a nova posição no CSS
    caminhoneteElement.style.left = `${currentLeft}%`;
    caminhoneteElement.style.bottom = `${currentBottom}px`;
    caminhoneteElement.style.transform = 'translateX(-50%)';
}

// NOVO: Função que verifica as teclas e chama moveCaminhonete.
// Chamada a cada frame (dentro do moveCars)
function moveCaminhoneteInLoop() {
    if (isGameOver) return;

    let deltaX = 0;
    let deltaY = 0;

    // Rastreia o estado das teclas
    const isAccelerating = keysPressed['ArrowUp'];
    const isMovingDownManually = keysPressed['ArrowDown'];

    // Movimento Vertical
    if (isAccelerating) {
        deltaY += VERTICAL_UNIT_FORWARD; // Velocidade RÁPIDA para frente
        

    } else if (isMovingDownManually) {
        // Ré manual (o jogador pressionou a seta para baixo)
        deltaY -= VERTICAL_UNIT_BACKWARD; 
    } else {
        // NOVO: Se o jogador não está acelerando (nem ré manual), aplica a ré automática
        // Simulando que o carro perde a aceleração e volta.
        deltaY -= VERTICAL_UNIT_BACKWARD; // Aplica a ré automática
    }

    // Movimento Horizontal (permite Esquerda e Direita simultâneos)
    if (keysPressed['ArrowLeft']) {
        deltaX -= HORIZONTAL_UNIT;
    }
    if (keysPressed['ArrowRight']) {
        deltaX += HORIZONTAL_UNIT;
    }

    // NOVO: Aplica a desaceleração horizontal nas diagonais para baixo (sensação de ré)
    // Isso garante que a diagonal para baixo seja lenta em ambos os eixos, seja ré manual ou automática
    if (!isAccelerating && (keysPressed['ArrowLeft'] || keysPressed['ArrowRight'])) {
        deltaX *= HORIZONTAL_SLOW_FACTOR;
    }

    // Se houver movimento acumulado (diagonal ou reto)
    if (deltaX !== 0 || deltaY !== 0) {
        moveCaminhonete(deltaX, deltaY);
    }
    
    // =================================================================
    // === LÓGICA ATUALIZADA: FALHA DE JOGO POR CONTRAMÃO SEM AVISO ===
    // =================================================================

    // Checa se o jogador ultrapassou o limite de tolerância (40%)
    if (currentLeft <= CONTRARIO_FAILURE_THRESHOLD) {
        // Falha no jogo por ir muito fundo na contramão
        contraMaoGameOver();
        return; 
    }
    // =================================================================
}

// NOVO: Função para registrar o estado da tecla (Substitui handleKeyPress)
function handleKeyEvents(event) {
    if (isGameOver) return;

    const key = event.key;

    // Apenas monitora as setas
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
        event.preventDefault(); // Previne o scroll da tela

        if (event.type === 'keydown') {
            keysPressed[key] = true;
        } else if (event.type === 'keyup') {
            keysPressed[key] = false;
        }
    }
}

/**
 * Função central para exibir a sobreposição de Fim de Jogo/Vitória.
 * @param {string} message - A mensagem a ser exibida.
 * @param {string} buttonText - O texto do botão (ex: "Reiniciar" ou "Continuar").
 * @param {function} buttonAction - A função a ser executada ao clicar no botão.
 */
function showOverlay(message, buttonText, buttonAction) {
    if (isGameOver) {
        clearInterval(gameLoopInterval);
        clearInterval(countdownInterval);
        window.removeEventListener('keydown', handleKeyEvents);
        window.removeEventListener('keyup', handleKeyEvents);
    } else {
        // Isso não deve acontecer se a isGameOver for definida corretamente
        return; 
    }

    // Verifica se os elementos foram encontrados (se seu HTML estiver correto)
    if (overlayElement && overlayMessage && restartBtn) {
        overlayMessage.textContent = message;
        restartBtn.textContent = buttonText;
        
        // Limpa listeners antigos para evitar chamadas duplicadas
        restartBtn.onclick = null; 
        
        // Configura a nova ação do botão
        restartBtn.onclick = buttonAction;

        // Exibe a sobreposição
        overlayElement.style.display = 'flex'; // ou 'block', dependendo do seu CSS
    } else {
        console.error("Erro: Elementos da sobreposição não encontrados. Revertendo para alert().");
        alert(`${message}\n\nO jogo será reiniciado.`);
        window.location.reload();
    }
}


// ====================================================================
// ============== 3. Funções de Colisão e Fim de Jogo (AGORA USAM showOverlay) ==============
// ====================================================================

function checkCollision(element1, element2) {
    if (!element1 || !element2) return false;

    const rect1 = element1.getBoundingClientRect();
    const rect2 = element2.getBoundingClientRect();

    return (
        rect1.left < rect2.right &&
        rect1.right > rect2.left &&
        rect1.top < rect2.bottom &&
        rect1.bottom > rect2.top
    );
}

// -------------------------------------------------------------
// FUNÇÃO DE VITÓRIA (Conclusão do Jogo após 1 minuto)
// -------------------------------------------------------------
function winGame() {
    if (isGameOver) return;

    isGameOver = true;

    showOverlay(
        "🎉 Você venceu! Próxima Fase!",
        "Continuar",
        // Função para "Continuar" - AGORA REDIRECIONA PARA tela3.html
        () => {
            // =========================================================
            // >>> ALTERAÇÃO AQUI <<<
            // =========================================================
            window.location.href = 'tela3.html'; 
            // =========================================================
        }
    );
}

// -------------------------------------------------------------
// Game Over por COLISÃO COM CARRO
// -------------------------------------------------------------
function gameOver() {
    if (isGameOver) return;

    isGameOver = true;

    showOverlay(
        "❌ FALHA NA MISSÃO! ❌\nVocê bateu o carro",
        "Reiniciar",
        () => {
            window.location.reload();
        }
    );
}

// -------------------------------------------------------------
// Game Over por CONTRAMÃO (Falha total)
// -------------------------------------------------------------
function contraMaoGameOver() {
    if (isGameOver) return;

    isGameOver = true;
    
    // Contramão usa a mesma mensagem e botão de colisão
    showOverlay(
        "❌ FALHA NA MISSÃO! ❌\nVocê entrou na contramão!",
        "Reiniciar",
        () => {
            window.location.reload();
        }
    );
}

// -------------------------------------------------------------
// Game Over por COLISÃO NO CANTEIRO
// -------------------------------------------------------------
function canteiroGameOver() {
    if (isGameOver) return;

    isGameOver = true;

    showOverlay(
        '⚠️ Falha na missão! ⚠️\nVocê invadiu o canteiro.',
        "Reiniciar",
        () => {
            window.location.reload();
        }
    );
}


// ====================================================================
// ============== 4. Loop do Jogo Principal (moveCars) ==============
// ====================================================================

// CONSTANTES PARA RESTRIGIR O MOVIMENTO DOS CARROS À DIREITA (Pista Principal)
const RIGHT_LANE_MIN = 65; // Posição mínima (Mais longe do colisor central)
const RIGHT_LANE_MAX = 85; // Posição máxima (Mais longe do colisor da direita)

// CONSTANTES PARA RESTRIGIR O MOVIMENTO DOS CARROS À ESQUERDA (Pista Contramão)
const LEFT_LANE_MIN = 15; // Posição mínima (Mais longe do colisor da esquerda)
const LEFT_LANE_MAX = 35; // Posição máxima (Mais longe do colisor central)


function moveCars() {
    if (isGameOver) return;

    // =================================================================
    // === ATUALIZAÇÃO DO FUNDO PARA EFEITO PARALLAX (COM CORREÇÃO DE LOOP) ===
    // =================================================================

    if (gameBoardElement) {
        // A pista se move para baixo (aumenta o Y) na velocidade dos carros
        backgroundPositionY += CAR_SPEED * BACKGROUND_SCROLL_FACTOR;
        
        // CORREÇÃO: Usa o operador de módulo para garantir um loop contínuo e suave
        backgroundPositionY %= BACKGROUND_RESET_HEIGHT; 

        // Aplica a nova posição ao fundo
        gameBoardElement.style.backgroundPositionY = `${backgroundPositionY}px`;
    }

    // =================================================================
    
    // Chama o movimento do jogador (incluindo a checagem de contramão e ré automática)
    moveCaminhoneteInLoop();

    // Se o jogo falhou na checagem de contramão, pare o resto do loop
    if (isGameOver) return; 

    // =================================================================
    // === CHECAGEM DE COLISÃO COM OS CANTEIROS (Colisor 1, 2 e 3) ===
    // =================================================================
    if (colisor1Element && checkCollision(caminhoneteElement, colisor1Element)) {
        canteiroGameOver();
        return;
    }
    
    if (colisor2Element && checkCollision(caminhoneteElement, colisor2Element)) {
        canteiroGameOver();
        return;
    }

    if (colisor3Element && checkCollision(caminhoneteElement, colisor3Element)) {
        canteiroGameOver();
        return;
    }
    // =================================================================


    const cars = [
        { element: carro1Element, key: 'carro1', lane: 'right' },
        { element: carro2Element, key: 'carro2', lane: 'right' },
        { element: carro3Element, key: 'carro3', lane: 'right' },
        // NOVOS CARROS: Pista Esquerda
        { element: carro4Element, key: 'carro4', lane: 'left' },
        { element: carro5Element, key: 'carro5', lane: 'left' },
        { element: carro6Element, key: 'carro6', lane: 'left' }
    ];

    cars.forEach(car => {
        if (!car.element) return;
        // Se o jogo falhou na verificação de contramão/colisão anterior, saia do loop
        if (isGameOver) return;

        let resetPosition; // Posição vertical de reset
        let randomMin, randomMax; // Limites horizontais
        let movementDirection; // Direção do movimento vertical

        if (car.lane === 'right') {
            // Pista da Direita (DESCENDO - Simula ser ultrapassado)
            carPositions[car.key] -= CAR_SPEED; // <--- MUDANÇA: SUBTRAI para descer
            resetPosition = window.innerHeight + 200; // Reseta para CIMA
            randomMin = RIGHT_LANE_MIN; // 65
            randomMax = RIGHT_LANE_MAX; // 85
            movementDirection = 'down'; // <--- MUDANÇA
        } else {
            // Pista da Esquerda (Descida/Contramão)
            carPositions[car.key] -= CAR_SPEED_REVERSE;
            resetPosition = window.innerHeight + 200; // Reseta para cima
            randomMin = LEFT_LANE_MIN; // 15
            randomMax = LEFT_LANE_MAX; // 35
            movementDirection = 'down';
        }

        // 1. Aplica a nova posição vertical
        car.element.style.bottom = `${carPositions[car.key]}px`;

        // 2. CHECAGEM DE COLISÃO COM CARROS
        if (checkCollision(caminhoneteElement, car.element)) {
            gameOver();
            return;
        }

        // 3. Verifica se o carro saiu da tela (e o reseta)
        // Se o carro estiver descendo (right lane ou left lane)
        if (movementDirection === 'down' && carPositions[car.key] < -200) { 
            
            // Reseta para cima da tela
            carPositions[car.key] = resetPosition;

            // Gera um número aleatório entre os limites da faixa
            const range = randomMax - randomMin;
            const randomLeft = Math.floor(Math.random() * range) + randomMin;

            // Aplica a nova posição X, que agora respeita os limites (15-35 ou 65-85)
            car.element.style.left = `${randomLeft}%`;
        
        // Mantive o 'up' por segurança, embora não seja usado na lógica atual
        } else if (movementDirection === 'up' && carPositions[car.key] > window.innerHeight) {

            // Reseta para baixo da tela
            carPositions[car.key] = -200; 

            // Gera um número aleatório entre os limites da faixa
            const range = randomMax - randomMin;
            const randomLeft = Math.floor(Math.random() * range) + randomMin;

            car.element.style.left = `${randomLeft}%`;
        }
    });

    // =================================================================
    // >>> NOVO: MOVIMENTO DA LOJA (SE ESTIVER ATIVA)
    // =================================================================
    if (lojaElement && lojaElement.style.visibility === 'visible') {
        let currentLojaPosition = parseFloat(lojaElement.getAttribute('data-loja-position'));
        
        // A loja desce na velocidade definida
        currentLojaPosition -= LOJA_SPEED; 

        // Aplica a nova posição (BOTTOM é o eixo de descida) e atualiza o atributo
        lojaElement.style.bottom = `${currentLojaPosition}px`;
        lojaElement.setAttribute('data-loja-position', currentLojaPosition);

        // Opcional: Checar se o jogador bateu na loja (após a loja entrar na tela)
        // Adicione esta checagem se a loja também for um obstáculo
        /*
        if (checkCollision(caminhoneteElement, lojaElement)) {
             gameOver(); // Se bater na loja for Game Over
             return;
        }
        */
    }
    // =================================================================
}


// ====================================================================
// ============== 5. Função de Inicialização (Configuração) ==============
// ====================================================================

function initializeMovement() {
    // ------------------------------------
    // 5.0. Configuração do Overlay
    // ------------------------------------
    overlayElement = document.getElementById('gameOverOverlay');
    overlayMessage = document.getElementById('overlayMessage');
    restartBtn = document.getElementById('restartBtn');
    
    // Esconde o overlay no início (IMPORTANTE!)
    if(overlayElement) {
        overlayElement.style.display = 'none'; 
    }

    // ------------------------------------
    // 5.1. Configuração do Game Board para Parallax
    // ------------------------------------
    gameBoardElement = document.querySelector('.game-board');

    // Isso garante que o fundo comece no topo (0)
    if (gameBoardElement) {
        gameBoardElement.style.backgroundPositionY = '0px'; 
    }


    // ------------------------------------
    // 5.2. Configuração do Player (Caminhonete)
    // ------------------------------------
    caminhoneteElement = document.querySelector('.caminhonetecomcaixa');

    if (!caminhoneteElement) {
        console.error("Erro: O elemento com a classe '.caminhonetecomcaixa' não foi encontrado.");
        return;
    }

    caminhoneteElement.style.position = 'absolute';
    caminhoneteElement.style.bottom = `${currentBottom}px`;
    caminhoneteElement.style.left = `${currentLeft}%`;
    caminhoneteElement.style.transform = 'translateX(-50%)';

    // Adiciona listeners keydown e keyup para rastrear o estado das teclas
    window.addEventListener('keydown', handleKeyEvents);
    window.addEventListener('keyup', handleKeyEvents);


    // ------------------------------------
    // 5.3. Configuração dos Carros (Inimigos)
    // ------------------------------------

    // Faixa Direita (Descendo - AGORA VÃO DESCER)
    carro1Element = document.querySelector('.carro1');
    carro2Element = document.querySelector('.carro2');
    carro3Element = document.querySelector('.carro3');

    // Faixa Esquerda (Descendo - Contramão)
    carro4Element = document.querySelector('.carro4');
    carro5Element = document.querySelector('.carro5');
    carro6Element = document.querySelector('.carro6');

    // Inicialização da Faixa Direita (Carros Descendo)
    // Eles devem começar com um valor alto de 'bottom' (acima do topo da tela)
    const initialTopRight = window.innerHeight + 200; 
    if (carro1Element) {
        carro1Element.style.position = 'absolute';
        carro1Element.style.bottom = `${initialTopRight}px`; 
        carPositions.carro1 = initialTopRight; // Posição inicial alta
        carro1Element.style.left = '60%'; // Esta posição inicial é substituída no primeiro loop
    }
    if (carro2Element) {
        carro2Element.style.position = 'absolute';
        carro2Element.style.bottom = `${initialTopRight + 400}px`; 
        carPositions.carro2 = initialTopRight + 400; // Posição inicial alta
        carro2Element.style.left = '75%'; // Esta posição inicial é substituída no primeiro loop
    }
    if (carro3Element) {
        carro3Element.style.position = 'absolute';
        carro3Element.style.bottom = `${initialTopRight + 800}px`; 
        carPositions.carro3 = initialTopRight + 800; // Posição inicial alta
        carro3Element.style.left = '85%'; // Esta posição inicial é substituída no primeiro loop
    }

    // Inicialização da Faixa Esquerda (Contramão - Descendo)
    const initialTopLeft = window.innerHeight + 200; 
    if (carro4Element) {
        carro4Element.style.position = 'absolute';
        carro4Element.style.bottom = `${initialTopLeft}px`;
        carPositions.carro4 = initialTopLeft;
        carro4Element.style.left = '20%'; // Esta posição inicial é substituída no primeiro loop
    }
    if (carro5Element) {
        carro5Element.style.position = 'absolute';
        carro5Element.style.bottom = `${initialTopLeft + 400}px`;
        carPositions.carro5 = initialTopLeft + 400;
        carro5Element.style.left = '35%'; // Esta posição inicial é substituída no primeiro loop
    }
    if (carro6Element) {
        carro6Element.style.position = 'absolute';
        carro6Element.style.bottom = `${initialTopLeft + 800}px`;
        carPositions.carro6 = initialTopLeft + 800;
        carro6Element.style.left = '15%'; // Esta posição inicial é substituída no primeiro loop
    }
    
    // ------------------------------------
    // 5.4. Configuração dos Colisores (Canteiros) 
    // ------------------------------------
    colisor1Element = document.querySelector('.colisor');
    colisor2Element = document.querySelector('.colisor2');
    colisor3Element = document.querySelector('.colisor3'); 

    if (!colisor1Element || !colisor2Element || !colisor3Element) {
        console.warn("Aviso: Nem todos os elementos colisor (colisor, colisor2 ou colisor3) foram encontrados. Verifique o HTML/CSS.");
    }
    
    // ------------------------------------
    // >>> NOVO: 5.5. Configuração da Loja
    // ------------------------------------
    lojaElement = document.querySelector('.loja');
    if (!lojaElement) {
        console.warn("Aviso: Elemento da Loja não encontrado.");
    }


    // ------------------------------------
    // 5.6. Configuração do Cronômetro
    // ------------------------------------
    timerElement = document.getElementById('timer-display');
    if (timerElement) {
        timerElement.textContent = formatTime(TOTAL_TIME_SECONDS);
        countdownInterval = setInterval(updateTimer, 1000); // Atualiza a cada 1 segundo (1000ms)
    } else {
        console.warn("Aviso: Elemento com ID 'timer-display' não encontrado. O cronômetro não será exibido.");
        countdownInterval = setInterval(updateTimer, 1000);
    }

    // ATIVA O MOVIMENTO CONTÍNUO DOS CARROS (Loop Principal do Jogo)
    gameLoopInterval = setInterval(moveCars, 30);


    console.log("✅ Jogo inicializado. Pop-ups substituídos por Overlay.");
}

// ====================================================================
// ============== 6. Execução ao Carregar a Página ==============
// ====================================================================

document.addEventListener('DOMContentLoaded', initializeMovement);