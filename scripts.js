document.getElementById("start-button").addEventListener("click", async function () {
    const startButton = document.getElementById("start-button");
    startButton.disabled = true;
    startButton.textContent = "Carregando jogo..."; 

    const numPairs = parseInt(document.getElementById("numPairs").value);
    if (numPairs < 2 || numPairs > 32) {
        alert("Por favor, escolha um número entre 2 e 32.");
        startButton.disabled = false;
        startButton.textContent = "Iniciar Jogo"; 
        return;
    }

    const cards = Array.from({ length: numPairs * 2 }, (_, index) => Math.floor(index / 2) + 1);
    await createCards(cards);

    startButton.disabled = false;
    startButton.textContent = "Iniciar Jogo"; 
});

async function generateImagePairs(numPairs) {
    const imagePairs = {};
    for (let i = 1; i <= numPairs; i++) {
        let id, url, response;
        do {
            id = Math.floor(Math.random() * 1000) + 1;
            url = `https://picsum.photos/id/${id}/300/400`;
            response = await fetch(url);
            if (!response.ok) {
                console.log("Image does not exist:", url);
            }
        } while (!response.ok);
        imagePairs[i] = [url, url];
    }
    return imagePairs;
}

function shuffleCards(cards) {
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
}

async function createCards(cards) {
    const numPairs = cards.length / 2;
    const imagePairs = await generateImagePairs(numPairs);
    shuffleCards(cards);
    const cardList = document.querySelector(".container");
    cardList.innerHTML = "";
    attempts=0;
    updateAttempts();
    for (let i = 0; i < cards.length; i++) {
        const card = document.createElement("div")
        const cardBack = document.createElement("div")
        const cardFront = document.createElement("div")

        card.classList.add("card")
        cardBack.classList.add("back")
        cardFront.classList.add("front");

        cardBack.style.backgroundImage = `url(img/card-back.png)`;

        const cardNumber = cards[i];
        const cardImage = imagePairs[cardNumber].pop()
        cardFront.style.backgroundImage = `url(${cardImage})`

        card.setAttribute("data-card", cardNumber)
        card.appendChild(cardBack)
        card.appendChild(cardFront)
        card.addEventListener("click", flipCard)
        cardList.appendChild(card)
    }

}

let flippedCards = 0;
let firstCard, secondCard;
let attempts = 0;

function flipCard() {
    if (flippedCards < 2 && !this.classList.contains("flip")) {
        flippedCards++;
        this.classList.add("flip");
        if (flippedCards === 1) {
            firstCard = this;
        } else {
            secondCard = this;
            attempts++;
            updateAttempts();
            checkforMatch();
        }

    }
}

function checkforMatch() {
    const isMatch = firstCard.getAttribute("data-card") === secondCard.getAttribute("data-card");
    isMatch ? disableCards() : unflipCards();

}

function disableCards() {
    firstCard.removeEventListener("click", flipCard)
    secondCard.removeEventListener("click", flipCard)

    if (document.querySelectorAll(".card:not(.flip)").length === 0) {
        showCongratulationsMessage()

    }

    resetBoard();
}

function unflipCards() {
    setTimeout(() => {
        firstCard.classList.remove("flip")
        secondCard.classList.remove("flip")
        resetBoard();
    }, 1000)


}

function resetBoard() {
    [flippedCards, firstCard, secondCard] = [0, null, null]
}

function updateAttempts() {
    const attemptsElements = document.querySelector(".attempts")
    attemptsElements.textContent = `Tentativas: ${attempts}`;
}

function showCongratulationsMessage() {
    const congratulationsMessage = document.querySelector(".congratulations-container");

    const congratulationsElement = document.createElement("p");

    congratulationsElement.classList.add("congratulations");

    congratulationsElement.textContent = `Parabéns! Você venceu em ${attempts} tentativas`;

    congratulationsMessage.appendChild(congratulationsElement);

    document.getElementById("start-button").textContent = "Jogar Novamente";
}

async function restartGame() {
    const startButton = document.getElementById("start-button");
    const congratulationsMessage = document.querySelector(".congratulations-container");
    congratulationsMessage.innerHTML = "";
   

    const cardList = document.querySelector(".container");
    cardList.innerHTML = "";
    await createCards(); 
    resetBoard();
    startButton.textContent = "Jogar Novamente"; 
}

document.getElementById("start-button").addEventListener("click", restartGame);



function zoomIn() {
    const container = document.querySelector('.container');
    const currentScale = parseFloat(container.style.transform.replace('scale(', '').replace(')', '')) || 1;
    const newScale = currentScale * 1.05; 
    if (newScale <= 1) {
        container.style.transform = `scale(${newScale})`;
    }
}


function zoomOut() {
    const container = document.querySelector('.container');
    const currentScale = parseFloat(container.style.transform.replace('scale(', '').replace(')', '')) || 1; 
    const newScale = currentScale * 0.9; 
    if (newScale >= 0.5) { 
        container.style.transform = `scale(${newScale})`;
    }
}

document.getElementById('zoom-in').addEventListener('click', zoomIn);
document.getElementById('zoom-out').addEventListener('click', zoomOut);

createCards();