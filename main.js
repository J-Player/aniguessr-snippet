// @ts-check

/**
 * Github: https://github.com/J-Player/aniguessr-snippet
 * 
 * Durante um intervalo fixo, o código irá ser executado uma única vez SEMPRE que a URL mudar:
 * 1. Identificar o jogo atualmente selecionado e faz uma requisição ao endpoint correspondente ao tipo de jogo
 * Quais?
 * screenshots => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/screenshots
 * - replay    => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/screenshots?date=<DATE>
 * characteres => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/characters
 * - replay    => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/characters?date=<DATE>
 * opening     => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/music
 * - replay    => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/music?date=<DATE>
 * ending      => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/endings
 * - replay    => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/endings?date=<DATE>
 * anidle      => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/animdle
 * - replay    => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/animdle?date=<DATE>
 * 2. Buscará os dados relacionados ao jogo atual e armazena o resultado na variável "game"
*/

/**
 * @param {string} url
 */
async function _getData(url) {
  try {
    console.log(`_getData: ${url}`)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error("Error no fetch: ", error)
  }
}

/**
 * @param {string} base64
 */
function _decodeBase64(base64) {
  try {
    return atob(base64)
  } catch (error) {
    console.error("Base64 inválido: ", error)
    throw error
  }
}

/**
 * @param {Date} date
 */
function _formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${year}${month}${day}`
}

/**
 * @param {string} dataString
 */
function _stringToDate(dataString) {
  const ano = Number(dataString.slice(0, 4))
  const mes = Number(dataString.slice(4, 6)) - 1
  const dia = Number(dataString.slice(6, 8))
  return new Date(ano, mes, dia)
}

function _formatResponse() {
  const response = []
  switch (game.type) {
    case "screenshots":
    case "music":
    case "endings":
      // @ts-ignore
      for (let phase of game.fullResponse) {
        response.push(phase.accepted_titles[0])
      }
      game.response = response
      break
    case "characters":
      // @ts-ignore
      for (const phase of game.fullResponse) {
        const round = []
        for (const character of phase["characters"]) {
          round.push([character.name, character.accepted_titles[0]])
        }
        response.push(round)
      }
      game.response = response
      break
  }
  return response
}
/**
 * @param {*} element 
 * @param {*} newValue 
 */
function _forceReactInputUpdate(element, newValue) {
  // Get the native input element value setter from the browser prototype
  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  // Run the native setter to bypass React's tracking mechanism
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, newValue);
  } else if (valueSetter) {
    valueSetter.call(element, newValue);
  } else {
    element.value = newValue;
  }
  // Dispatch a bubbling input event so React's onChange listener intercepts it
  const event = new Event('input', { bubbles: true });
  element.dispatchEvent(event);
}

function putResponse() {
  const roundElement = document.querySelector("#game_container > div > h2")
  if (roundElement) {
    const REGEX = /\d+/
    const currentRound = Number(roundElement.textContent?.match(REGEX)?.[0]) - 1
    const inputs = document.querySelectorAll("#game_container input[type='text']")
    const startIndex = currentRound * inputs.length
    let response = null
    if (inputs.length == 1) {
      response = game.response[currentRound]
      _forceReactInputUpdate(inputs[0], response)
      console.log(`Round ${currentRound + 1} | response: ${response}`)
    } else {
      const checkArray = (/** @type {unknown} */ arr) => Array.isArray(arr) && arr.every(item => Array.isArray(item))
      if (checkArray(game.response)) {
        let roundResponses = game.response[currentRound].flat()
        for (let i = 0; i < inputs.length; i += 2) {
          response = game.response[currentRound].flat()[i]
          const node = inputs[i]
          // @ts-ignore
          if (node.value?.length > 0) continue
          _forceReactInputUpdate(inputs[i], roundResponses[i])
          _forceReactInputUpdate(inputs[i + 1], roundResponses[i + 1])
          console.log(`Round ${currentRound + 1} | character: ${roundResponses[i]} | anime: ${roundResponses[i + 1]}`)
        }
      }
    }
  }
}

/**
 * @typedef {Object} Config
 * @property {boolean} enabledAlert
 */

/** @type {Config} */
const configs = {
  enabledAlert: true
}

/**
 * @typedef {Object} Game
 * @property {Date} date
 * @property {string} type
 * @property {Object} fullResponse
 * @property {any[]} animes
 * @property {any[]} response
 */

/** @type {Game} */
const game = {
  date: new Date(),
  type: "",
  fullResponse: {},
  response: [],
  animes: []
};

(async () => {
  let url = "https://cms.aniguessr.com/wp-json/aniguessr/v1/autocomplete/anime"
  game.animes = await _getData(url)
  let lastUrl = location.href
  let interval = -1
  setInterval(async () => {
    if (location.href !== lastUrl) {
      if (interval != -1) clearInterval(interval)
      lastUrl = location.href
      let gameData = null
      const DATE = new Date()
      let dateFormatted = _formatDate(DATE)
      let gameType = null
      let baseUrl = "https://cms.aniguessr.com/wp-json/aniguessr/v1/game"
      const REGEX = /https:\/\/aniguessr.com\/(replay\/(?<date>\d+)\/(?<gameReplay>.+))|(?<game>guess-.+|anidle)/
      if (REGEX.test(lastUrl)) {
        console.clear()
        const buttonId = "cheat-button"
        const MATCHES = lastUrl.match(REGEX)
        if (MATCHES?.groups) {
          dateFormatted = MATCHES.groups.date || dateFormatted
          gameType = MATCHES?.groups.gameReplay || MATCHES?.groups.game
          gameType = gameType.split("-")
          gameType = gameType[gameType.length - 1]
          switch (gameType) {
            case "anime":
              gameType = "screenshots"
              break
            case "opening":
              gameType = "music"
              break
            case "ending":
              gameType = "endings"
              break
          }
          baseUrl += `/${gameType}`
          if (lastUrl.includes("replay")) baseUrl += `?date=${dateFormatted}`
          let year = dateFormatted.slice(0, 4)
          let month = dateFormatted.slice(4, 6)
          let day = dateFormatted.slice(6, 8)
          dateFormatted = `\nData: ${day}/${month}/${year}\n`
          if (gameType != "anidle") gameData = await _getData(baseUrl)
          if (gameData != null && gameData["game_data"].length > 0) {
            game["date"] = _stringToDate(dateFormatted)
            game["type"] = gameType
            game["fullResponse"] = JSON.parse(_decodeBase64(gameData["game_data"]))
            game.response = _formatResponse()
            gameData = JSON.parse(_decodeBase64(gameData["game_data"]))
            if (configs.enabledAlert) alert(`Dados do jogo "${gameType}" obtidos com sucesso! 🥳\n` +
              dateFormatted +
              '\nPara ver a resposta acesse "game.response" no console de desenvolvedor. 😎\n' +
              '\nPara desativar os alertas digite "enabledAlert = false" no console de desenvolvedor. 🤫')
            setTimeout(() => {
              interval = setInterval(() => {
                const buttonExists = document.getElementById(buttonId)
                if (buttonExists) return
                const element = document.evaluate("//button[@type='submit']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
                const parent = element?.parentElement
                if (parent != null) {
                  parent.style.display = "flex"
                  parent.style.width = "fit-content"
                  parent.style.alignItems = "center"
                  parent.style.gap = "10px"
                  parent.style.marginLeft = "auto"
                  parent.style.marginRight = "auto"
                  const buttonCheat = document.createElement("button")
                  buttonCheat.id = buttonId
                  buttonCheat.textContent = "UwU"
                  buttonCheat.type = "button"
                  // @ts-ignore
                  buttonCheat.classList.add(...element.classList)
                  buttonCheat.style.cursor = "pointer"
                  buttonCheat.style.textTransform = "none"
                  if (!document.getElementById("uwu-style")) {
                    const style = document.createElement("style")
                    style.id = "uwu-style"
                    style.textContent = [
                      "@keyframes zFloat { to { opacity: 0; transform: translateY(-30px) scale(1.4); } }",
                      ".uwu-z { position: absolute; pointer-events: none; font-weight: bold; animation: zFloat 1s ease-out forwards; }"
                    ].join(" ")
                    document.head.appendChild(style)
                  }
                  buttonCheat.style.position = "relative"
                  let zInterval = setInterval(() => {
                    const z = document.createElement("span")
                    z.className = "uwu-z"
                    z.textContent = ["z", "Z", "Z"][Math.floor(Math.random() * 3)]
                    z.style.left = Math.random() * 100 + "%"
                    z.style.top = Math.random() * 100 + "%"
                    z.style.fontSize = (10 + Math.random() * 12) + "px"
                    z.style.color = "white"
                    buttonCheat.appendChild(z)
                    setTimeout(() => z.remove(), 1000)
                  }, 200)
                  buttonCheat.addEventListener("click", () => putResponse())
                  buttonCheat.addEventListener("mouseenter", () => {
                    clearInterval(zInterval)
                    buttonCheat.textContent = "OwO"
                  })
                  buttonCheat.addEventListener("mouseleave", () => {
                    buttonCheat.textContent = "UwU"
                    zInterval = setInterval(() => {
                      const z = document.createElement("span")
                      z.className = "uwu-z"
                      z.textContent = ["z", "Z", "Z"][Math.floor(Math.random() * 3)]
                      z.style.left = Math.random() * 100 + "%"
                      z.style.top = Math.random() * 100 + "%"
                      z.style.fontSize = (10 + Math.random() * 12) + "px"
                      z.style.color = "white"
                      buttonCheat.appendChild(z)
                      setTimeout(() => z.remove(), 1000)
                    }, 200)
                  })
                  buttonCheat.addEventListener("mousedown", () => {
                    buttonCheat.textContent = ">w<"
                  })
                  parent.appendChild(buttonCheat)
                  if (!document.getElementById("reset")) {
                    const resetButton = document.createElement("button")
                    resetButton.id = "reset"
                    resetButton.textContent = "Reset"
                    resetButton.type = "reset"
                    // @ts-ignore
                    resetButton.classList.add(...element.classList)
                    resetButton.style.cursor = "pointer"
                    resetButton.style.backgroundColor = "#424242"
                    resetButton.addEventListener("click", () => {
                      let buttons = document.querySelectorAll("form button[title='Clear']")
                      // @ts-ignore
                      buttons.forEach(v => v.click())
                    })
                    parent.appendChild(resetButton)
                  }
                }
              }, 1000)
            }, 1000)
          } else {
            const buttonCheat = document.getElementById(buttonId)
            if (buttonCheat) buttonCheat.remove()
            if (configs.enabledAlert) alert([
              `Não foi possível encontrar os dados do jogo "${gameType}" 😭`,
              dateFormatted,
              `Se o tipo de jogo é "${gameType}" infelizmente não dá para trapaçear ¯\\_(ツ)_/¯`
            ].join("\n"))
          }
        }
      }
    }
  }, 1000)
}
)()