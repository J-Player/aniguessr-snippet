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
 * anidle      => https://cms.aniguessr.com/wp-json/aniguessr/v1/animdle?answer=<ANSWER>
 * - replay    => https://cms.aniguessr.com/wp-json/aniguessr/v1/animdle?answer=<ANSWER>&date=<DATE>
 * 2. Buscará os dados relacionados ao jogo atual e armazena o resultado na variável "game"
 * 3. Um botão de trapaça será criado dinamicamente e quando o usuário clicar nesse botão, a resposta será
 * automaticamente inserida no(s) input(s) do jogo atual APENAS SE o input estiver vazio
 */

/**
 * @param {string} url
 */
async function _getData(url, logs = true) {
  try {
    if (logs) console.log(`_getData: ${url}`)
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`)
    }
    return await response.json()
  } catch (error) {
    console.error("Error no fetch: ", error)
    return null
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
    case "animdle":
      response.push(game.fullResponse["answer_data"]["title"] || game.fullResponse["answer_data"]["title2"])
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
  const valueSetter = Object.getOwnPropertyDescriptor(element, 'value')?.set
  const prototype = Object.getPrototypeOf(element)
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  // Run the native setter to bypass React's tracking mechanism
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, newValue)
  } else if (valueSetter) {
    valueSetter.call(element, newValue)
  } else {
    element.value = newValue
  }
  // Dispatch a bubbling input event so React's onChange listener intercepts it
  const event = new Event('input', { bubbles: true })
  element.dispatchEvent(event)
}

/**
 * @param {Element} input
 * @param {any[]} items
 */
function _updateDropdownList(input, items) {
  const elements = document.querySelectorAll('ul.MuiAutocomplete-listbox')
  let listbox = null
  for (const element of elements.values()) {
    if (element.id.startsWith(input.id)) {
      listbox = element
      break
    }
  }
  if (listbox == null) return
  const itemListElement = listbox.querySelectorAll("li")
  if (!itemListElement.length) return
  const template = itemListElement[0]
  listbox.querySelectorAll("[data-custom]").forEach(el => el.remove())
  const originalItems = new Set([...itemListElement].map(el => el.textContent?.trim().toLowerCase()))
  items = items.filter(v => !originalItems.has(v.trim().toLowerCase())
  ).sort()

  /**
   * @type {Node | null}
   */
  let lastFocused = null
  items.forEach((/** @type {string | null} */ item, /** @type {number} */ index) => {
    const clone = template.cloneNode(true)
    clone.textContent = item
    const optionIndex = itemListElement.length + index
    clone.id = `${listbox.id.slice(0, listbox.id.lastIndexOf("-"))}-option-${optionIndex}`
    clone.setAttribute("data-option-index", optionIndex)
    clone.setAttribute("data-custom", "true")
    clone.setAttribute("aria-selected", "false")
    clone.addEventListener("mouseenter", () => {
      lastFocused?.classList.remove("Mui-focused")
      listbox.querySelector(".Mui-focused")?.classList.remove("Mui-focused")
      clone.classList.add("Mui-focused")
      lastFocused = clone
    })
    clone.addEventListener("mouseleave", () => clone.classList.remove("Mui-focused"))
    clone.addEventListener("mousedown", (e) => {
      e.preventDefault()
    })
    clone.addEventListener("click", e => {
      _forceReactInputUpdate(input, item)
      input.dispatchEvent(new Event("input", { bubbles: true }))
      input.dispatchEvent(new Event("change", { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent("keydown", {
        bubbles: true,
        key: "Enter"
      }))
    })
    listbox.appendChild(clone)
  })
}

function putResponse() {
  const roundElement = document.querySelector("#game_container > div > h2")
  const REGEX = /\d+/
  const currentRound = Number(roundElement?.textContent?.match(REGEX)?.[0]) - 1 || 0
  const inputs = document.querySelectorAll("#game_container input[type='text']")
  let response = null
  if (inputs.length == 1) {
    response = game.response[currentRound]
    _forceReactInputUpdate(inputs[0], response)
    if (roundElement) console.log(`Round ${currentRound + 1} | response: ${response}`)
    else console.log(`response: ${response}`)
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

async function getAnimes(forceUpdate = false) {
  const cached = localStorage.getItem("animes")
  if (cached) {
    game.animes = JSON.parse(cached)
    console.log(`Total de animes: ${game.animes.length}`)
    if (!forceUpdate) return game.animes
  }
  const animes = []
  let page = 1
  let lastProgress = -1
  // @ts-ignore
  const getURL = (page) => `https://cms.aniguessr.com/wp-json/aniguessr/v1/database?page=${page}&search=&first_letter=`
  do {
    const response = await _getData(getURL(page), false)
    const batch = response["animes"]
    if (!batch?.length) break
    animes.push(...batch)
    page++
    const progress = Math.floor((animes.length / Number(response["total_items"])) * 100)
    if (progress % 5 === 0 && progress !== lastProgress) {
      lastProgress = progress
      console.log(`Baixando dados... (${progress}%) (Página ${page - 1} de ${response["total_pages"]})`)
    }
  } while (true)
  localStorage.setItem("animes", JSON.stringify(animes))
  console.log(`Animes salvos com sucesso! (total: ${animes.length})`)
  game.animes = animes
  return animes
}


async function getCharacters(forceUpdate = false) {
  if (game.characters?.length && !forceUpdate) return game.characters
  const cached = localStorage.getItem("characters")
  if (cached && !forceUpdate) {
    game.characters = JSON.parse(cached)
    return game.characters
  }
  const response = await _getData(`https://cms.aniguessr.com/wp-json/aniguessr/v1/autocomplete/character`)
  const characters = response instanceof Object ? Object.values(response) : []
  if (characters.length) localStorage.setItem("characters", JSON.stringify(characters))
  game.characters = characters
  return characters
}

/**
 * @typedef {Object} DropdownListConfig
 * @property {number} limit
 * @typedef {Object} Config
 * @property {boolean} enabledAlert
 * @property {DropdownListConfig} dropdownList
 */

/** @type {Config} */
const configs = {
  enabledAlert: true,
  dropdownList: {
    limit: 50
  }
}

/**
 * @typedef {Object} Game
 * @property {Date} date
 * @property {string} type
 * @property {Object} fullResponse
 * @property {any[]} response
 * @property {any[]} animes
 * @property {any[]} characters
 */

/** @type {Game} */
const game = {
  date: new Date(),
  type: "",
  fullResponse: {},
  response: [],
  animes: [],
  characters: [],
};

(async () => {
  game.animes = await getAnimes()
  game.characters = await getCharacters()
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
      let baseUrl = "https://cms.aniguessr.com/wp-json/aniguessr/v1"
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
            case "anidle":
              gameType = "animdle"
              break
          }
          baseUrl += gameType == "animdle" ? `/${gameType}` : `/game/${gameType}`
          const queries = []
          if (gameType == "animdle") queries.push(`answer=a`, "round=22")
          if (lastUrl.includes("replay")) queries.push(`date=${dateFormatted}`)
          if (queries.length > 0) baseUrl += `?${queries.join("&")}`
          const year = dateFormatted.slice(0, 4)
          const month = dateFormatted.slice(4, 6)
          const day = dateFormatted.slice(6, 8)
          dateFormatted = `\nData: ${day}/${month}/${year}\n`
          gameData = await _getData(baseUrl)
          if (gameData != null) {
            game["date"] = _stringToDate(dateFormatted)
            game["type"] = gameType
            if (gameType == "animdle") {
              delete gameData["response"]
              delete gameData["data"]
              gameData["clues"] = JSON.parse(_decodeBase64(gameData["clues"]))
              game["fullResponse"] = gameData
            } else game["fullResponse"] = JSON.parse(_decodeBase64(gameData["game_data"]))
            game.response = _formatResponse()
            if (configs.enabledAlert) alert(`Dados do jogo "${gameType}" obtidos com sucesso! 🥳\n` +
              dateFormatted +
              '\nPara ver a resposta acesse "game.response" no console de desenvolvedor. 😎\n' +
              '\nPara desativar os alertas digite "configs.enabledAlert = false" no console de desenvolvedor. 🤫')
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
              const inputs = document.querySelectorAll("#game_container input[type='text']")
              const animeTitles = game.animes.flatMap(x => [x.title, x.title_2])
              inputs.forEach((input, index) => {
                input.addEventListener("input", e => {
                  // @ts-ignore
                  const valor = e.target.value.toLowerCase()
                  let items = index % 2 == 0 ? game.characters : animeTitles
                  items = items.filter(v => v.toLowerCase().includes(valor)).sort().slice(0, configs.dropdownList.limit)
                  setTimeout(() => _updateDropdownList(input, items), 150)
                })
              })
            }, 1000)
          } else {
            const buttonCheat = document.getElementById(buttonId)
            if (buttonCheat) buttonCheat.remove()
            alert([
              `Não foi possível encontrar os dados do jogo "${gameType}" 😭`,
              dateFormatted,
              `Verifique os logs no console para saber o que aconteceu 🔎`
            ].join("\n"))
          }
        }
      }
    }
  }, 1000)
}
)()