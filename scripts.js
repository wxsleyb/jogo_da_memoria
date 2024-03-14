const cards = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15, 16, 16];
//const cards = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8];
async function generateImagePairs() {
    const imagePairs = {};
    for (let i = 0; i < cards.length; i++) {
        if (!imagePairs[cards[i]]) {
            let id, url, response;
            do {
                id = Math.floor(Math.random() * 1000) + 1;
                url = `https://picsum.photos/id/${id}/300/400`;
                response = await fetch(url);
                if (!response.ok) {
                    console.log("Image does not exist:", url);
                }
            } while (!response.ok);
            imagePairs[cards[i]] = [url, url];
        }
    }
    return imagePairs;
}

function shuffleCards(cards) {
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }
}

async function createCards() {
    const imagePairs = await generateImagePairs()
    shuffleCards(cards);
    const cardList = document.querySelector(".container")
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

    if (document.querySelectorAll(".card:not(.flip)").length === 0){
        showCongratulationsMessage()

    }

    resetBoard();
}

function unflipCards(){
    setTimeout(()=> {
        firstCard.classList.remove("flip")
        secondCard.classList.remove("flip")
        resetBoard();
    }, 1000)


}

function resetBoard(){
    [flippedCards, firstCard, secondCard] = [0,null,null]
}

function updateAttempts() {
    const attemptsElements = document.querySelector(".attempts")
    attemptsElements.textContent = `Tentativas: ${attempts}`;
}

function showCongratulationsMessage(){
    const congratulationsMessage = document.querySelector(".congratulations-container");

    const congratulationsElement = document.createElement("p");

    congratulationsElement.classList.add("congratulations");

    congratulationsElement.textContent = `Parabéns! Você venceu em ${attempts} tentativas`;

    congratulationsMessage.appendChild(congratulationsElement);
}

function restartGame() {
    const congratulationsMessage = document.querySelector(".congratulations-container");
    congratulationsMessage.innerHTML = ""; // Remove a mensagem de parabéns
    attempts = 0;
    updateAttempts();

    // Limpar o contêiner de cartas antes de criar novas cartas
    const cardList = document.querySelector(".container");
    cardList.innerHTML = "";

    createCards(); // Gera um novo conjunto de cartas e reinicia o jogo
    resetBoard();
}


document.getElementById("restart-button").addEventListener("click", restartGame);


createCards();