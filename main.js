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

const BASE_API_URL = "https://cms.aniguessr.com/wp-json/aniguessr/v1"
const BUTTON_ID = "cheat-button"
const URL_REGEX = /https:\/\/aniguessr.com\/(replay\/(?<date>\d+)\/(?<gameReplay>.+))|(?<game>guess-.+|anidle)/

/** @type {Record<string, string>} */
const GAME_TYPE_MAP = {
  anime: "screenshots",
  opening: "music",
  ending: "endings",
  anidle: "animdle",
}

const ZZ_CHARS = ["z", "Z", "Z"]

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
  dropdownList: { limit: 50 },
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
}

// ─── HTTP / Data ──────────────────────────────────────────────────────────────

/**
 * @param {string} url
 * @param {boolean} [logs]
 */
async function _getData(url, logs = true) {
  try {
    if (logs) console.log(`_getData: ${url}`)
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Response status: ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error("Error no fetch: ", error)
    return null
  }
}

// ─── Encoding / Date ─────────────────────────────────────────────────────────

/** @param {string} base64 */
function _decodeBase64(base64) {
  try {
    return atob(base64)
  } catch (error) {
    console.error("Base64 inválido: ", error)
    throw error
  }
}

/** @param {Date} date */
function _formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${date.getFullYear()}${month}${day}`
}

/** @param {string} dataString */
function _stringToDate(dataString) {
  return new Date(
    Number(dataString.slice(0, 4)),
    Number(dataString.slice(4, 6)) - 1,
    Number(dataString.slice(6, 8))
  )
}

// ─── Game data ────────────────────────────────────────────────────────────────

function _formatResponse() {
  const response = []
  switch (game.type) {
    case "screenshots":
    case "music":
    case "endings":
      // @ts-ignore
      for (const phase of game.fullResponse)
        response.push(phase.accepted_titles[0])
      break
    case "characters":
      // @ts-ignore
      for (const phase of game.fullResponse) {
        const round = []
        for (const character of phase["characters"])
          round.push([character.name, character.accepted_titles[0]])
        response.push(round)
      }
      break
    case "animdle":
      response.push(
        // @ts-ignore
        game.fullResponse["answer_data"]["title"] ||
        // @ts-ignore
        game.fullResponse["answer_data"]["title2"]
      )
      break
  }
  game.response = response
  return response
}

/**
 * Resolve o tipo de jogo a partir do fragmento da URL.
 * @param {string} raw
 */
function _resolveGameType(raw) {
  const last = raw.split("-").at(-1) ?? raw
  return GAME_TYPE_MAP[last] ?? last
}

/**
 * Monta a URL da API para o jogo atual.
 * @param {string} gameType
 * @param {string} dateFormatted
 * @param {boolean} isReplay
 */
function _buildGameUrl(gameType, dateFormatted, isReplay) {
  let url = BASE_API_URL + (gameType === "animdle" ? `/${gameType}` : `/game/${gameType}`)
  const queries = []
  if (gameType === "animdle") queries.push("answer=a", "round=22")
  if (isReplay) queries.push(`date=${dateFormatted}`)
  if (queries.length) url += `?${queries.join("&")}`
  return url
}

/**
 * Extrai e normaliza os dados do jogo recebidos da API.
 * @param {any} gameData
 * @param {string} gameType
 */
function _parseGameData(gameData, gameType) {
  if (gameType === "animdle") {
    delete gameData["response"]
    delete gameData["data"]
    gameData["clues"] = JSON.parse(_decodeBase64(gameData["clues"]))
    return gameData
  }
  return JSON.parse(_decodeBase64(gameData["game_data"]))
}

// ─── Cache ────────────────────────────────────────────────────────────────────

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
  const getURL = (/** @type {number} */ p) =>
    `${BASE_API_URL}/database?page=${p}&search=&first_letter=`
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
  const response = await _getData(`${BASE_API_URL}/autocomplete/character`)
  const characters = response instanceof Object ? Object.values(response) : []
  if (characters.length) localStorage.setItem("characters", JSON.stringify(characters))
  game.characters = characters
  return characters
}

// ─── React input ─────────────────────────────────────────────────────────────

/**
 * @param {Element} element
 * @param {any} newValue
 */
function _forceReactInputUpdate(element, newValue) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")?.set
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter)
    prototypeValueSetter.call(element, newValue)
  else if (valueSetter)
    valueSetter.call(element, newValue)
  else
    // @ts-ignore
    element.value = newValue
  element.dispatchEvent(new Event("input", { bubbles: true }))
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────

/**
 * @param {Element} input
 * @param {any[]} items
 */
function _updateDropdownList(input, items) {
  let listbox = null
  for (const el of document.querySelectorAll("ul.MuiAutocomplete-listbox")) {
    if (el.id.startsWith(input.id)) { listbox = el; break }
  }
  if (!listbox) return
  const itemListElement = listbox.querySelectorAll("li")
  if (!itemListElement.length) return
  const template = itemListElement[0]
  listbox.querySelectorAll("[data-custom]").forEach(el => el.remove())
  const originalItems = new Set([...itemListElement].map(el => el.textContent?.trim().toLowerCase()))
  items = items.filter(v => !originalItems.has(v.trim().toLowerCase())).sort()

  /** @type {Node | null} */
  let lastFocused = null
  items.forEach((/** @type {string} */ item, /** @type {number} */ index) => {
    const clone = template.cloneNode(true)
    const optionIndex = itemListElement.length + index
    // @ts-ignore
    clone.textContent = item
    // @ts-ignore
    clone.id = `${listbox.id.slice(0, listbox.id.lastIndexOf("-"))}-option-${optionIndex}`
    // @ts-ignore
    clone.setAttribute("data-option-index", optionIndex)
    // @ts-ignore
    clone.setAttribute("data-custom", "true")
    // @ts-ignore
    clone.setAttribute("aria-selected", "false")
    // @ts-ignore
    clone.addEventListener("mouseenter", () => {
      // @ts-ignore
      lastFocused?.classList.remove("Mui-focused")
      listbox.querySelector(".Mui-focused")?.classList.remove("Mui-focused")
      // @ts-ignore
      clone.classList.add("Mui-focused")
      lastFocused = clone
    })
    // @ts-ignore
    clone.addEventListener("mouseleave", () => clone.classList.remove("Mui-focused"))
    // @ts-ignore
    clone.addEventListener("mousedown", e => e.preventDefault())
    // @ts-ignore
    clone.addEventListener("click", () => {
      _forceReactInputUpdate(input, item)
      input.dispatchEvent(new Event("input", { bubbles: true }))
      input.dispatchEvent(new Event("change", { bubbles: true }))
      input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }))
    })
    listbox.appendChild(clone)
  })
}

// ─── Cheat response ───────────────────────────────────────────────────────────

function putResponse() {
  const roundElement = document.querySelector("#game_container > div > h2")
  const currentRound = Number(roundElement?.textContent?.match(/\d+/)?.[0]) - 1 || 0
  const inputs = document.querySelectorAll("#game_container input[type='text']")
  if (inputs.length === 1) {
    const response = game.response[currentRound]
    _forceReactInputUpdate(inputs[0], response)
    console.log(roundElement ? `Round ${currentRound + 1} | response: ${response}` : `response: ${response}`)
    return
  }
  const isNestedArray = (/** @type {unknown} */ arr) => Array.isArray(arr) && arr.every(item => Array.isArray(item))
  if (!isNestedArray(game.response)) return
  const roundResponses = game.response[currentRound].flat()
  for (let i = 0; i < inputs.length; i += 2) {
    let anime = roundResponses[i]
    let character = roundResponses[i + 1]
    // @ts-ignore
    if (inputs[i].value?.length == 0) {
      _forceReactInputUpdate(inputs[i], roundResponses[i])
    } else {
      // @ts-ignore
      character = `${inputs[i].value} (User's response)`
    }
    // @ts-ignore
    if (inputs[i + 1].value?.length == 0) {
      _forceReactInputUpdate(inputs[i + 1], roundResponses[i + 1])
      anime = roundResponses[i + 1]
    } else {
      // @ts-ignore
      anime = `${inputs[i + 1].value} (User's response)`
    }
    console.log(`Round ${currentRound + 1} | character: ${character} | anime: ${anime}`)
  }
}

// ─── UI ───────────────────────────────────────────────────────────────────────

function _injectZStyle() {
  if (document.getElementById("uwu-style")) return
  const style = document.createElement("style")
  style.id = "uwu-style"
  style.textContent = [
    "@keyframes zFloat { to { opacity: 0; transform: translateY(-30px) scale(1.4); } }",
    ".uwu-z { position: absolute; pointer-events: none; font-weight: bold; animation: zFloat 1s ease-out forwards; }",
  ].join(" ")
  document.head.appendChild(style)
}

/** @param {HTMLElement} btn */
function _createZInterval(btn) {
  return setInterval(() => {
    const z = document.createElement("span")
    z.className = "uwu-z"
    z.textContent = ZZ_CHARS[Math.floor(Math.random() * ZZ_CHARS.length)]
    z.style.left = Math.random() * 100 + "%"
    z.style.top = Math.random() * 100 + "%"
    z.style.fontSize = 10 + Math.random() * 12 + "px"
    z.style.color = "white"
    btn.appendChild(z)
    setTimeout(() => z.remove(), 1000)
  }, 200)
}

/**
 * @param {Element} submitButton
 * @returns {HTMLButtonElement}
 */
function _createCheatButton(submitButton) {
  const btn = document.createElement("button")
  btn.id = BUTTON_ID
  btn.textContent = "UwU"
  btn.type = "button"
  // @ts-ignore
  btn.classList.add(...submitButton.classList)
  btn.style.cssText = "cursor:pointer;text-transform:none;position:relative;"
  _injectZStyle()
  let zInterval = _createZInterval(btn)
  btn.addEventListener("click", () => putResponse())
  btn.addEventListener("mouseenter", () => { clearInterval(zInterval); btn.textContent = "OwO" })
  btn.addEventListener("mouseleave", () => { btn.textContent = "UwU"; zInterval = _createZInterval(btn) })
  btn.addEventListener("mousedown", () => { btn.textContent = ">w<" })
  return btn
}

/**
 * @param {Element} submitButton
 * @returns {HTMLButtonElement}
 */
function _createResetButton(submitButton) {
  const btn = document.createElement("button")
  btn.id = "reset"
  btn.textContent = "Reset"
  btn.type = "reset"
  // @ts-ignore
  btn.classList.add(...submitButton.classList)
  btn.style.cssText = "cursor:pointer;background-color:#424242;"
  btn.addEventListener("click", () => {
    document.querySelectorAll("form button[title='Clear']").forEach(v => /** @type {HTMLElement} */(v).click())
  })
  return btn
}

/** @param {HTMLElement} parent */
function _styleButtonContainer(parent) {
  Object.assign(parent.style, {
    display: "flex",
    width: "fit-content",
    alignItems: "center",
    gap: "10px",
    marginLeft: "auto",
    marginRight: "auto",
  })
}

function _injectCheatButton() {
  if (document.getElementById(BUTTON_ID)) return
  const submitEl = /** @type {HTMLElement | null} */ (
    document.evaluate("//button[@type='submit']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
  )
  const parent = submitEl?.parentElement
  if (!parent) return
  _styleButtonContainer(parent)
  parent.appendChild(_createCheatButton(submitEl))
  if (!document.getElementById("reset")) parent.appendChild(_createResetButton(submitEl))
}

function _setupInputListeners() {
  const inputs = document.querySelectorAll("#game_container input[type='text']")
  const animeTitles = game.animes.flatMap(x => [x.title, x.title_2])
  inputs.forEach((input, index) => {
    input.addEventListener("input", e => {
      // @ts-ignore
      const valor = e.target.value.toLowerCase()
      let items = index % 2 === 0 && inputs.length > 1 ? game.characters : animeTitles
      items = items.filter(v => v.toLowerCase().includes(valor)).sort().slice(0, configs.dropdownList.limit)
      setTimeout(() => _updateDropdownList(input, items), 150)
    })
  })
}

// ─── URL watcher ─────────────────────────────────────────────────────────────

/**
 * @param {string} url
 */
async function _handleUrlChange(url) {
  if (!URL_REGEX.test(url)) return
  console.clear()
  const matches = url.match(URL_REGEX)
  if (!matches?.groups) return

  let dateFormatted = _formatDate(new Date())
  const rawType = matches.groups.gameReplay || matches.groups.game
  const gameType = _resolveGameType(rawType)
  const isReplay = url.includes("replay")
  if (matches.groups.date) dateFormatted = matches.groups.date

  const apiUrl = _buildGameUrl(gameType, dateFormatted, isReplay)
  const gameData = await _getData(apiUrl)

  if (!gameData) {
    const year = dateFormatted.slice(0, 4)
    const month = dateFormatted.slice(4, 6)
    const day = dateFormatted.slice(6, 8)
    const displayDate = `\nData: ${day}/${month}/${year}\n`
    document.getElementById(BUTTON_ID)?.remove()
    alert([`Não foi possível encontrar os dados do jogo "${gameType}" 😭`, displayDate, `Verifique os logs no console para saber o que aconteceu 🔎`].join("\n"))
    return
  }

  const year = dateFormatted.slice(0, 4)
  const month = dateFormatted.slice(4, 6)
  const day = dateFormatted.slice(6, 8)
  const displayDate = `\nData: ${day}/${month}/${year}\n`

  game.date = _stringToDate(dateFormatted)
  game.type = gameType
  game.fullResponse = _parseGameData(gameData, gameType)
  game.response = _formatResponse()

  if (configs.enabledAlert)
    alert(
      `Dados do jogo "${gameType}" obtidos com sucesso! 🥳\n` +
      displayDate +
      '\nPara ver a resposta acesse "game.response" no console de desenvolvedor. 😎\n' +
      '\nPara desativar os alertas digite "configs.enabledAlert = false" no console de desenvolvedor. 🤫'
    )

  setTimeout(() => {
    setInterval(_injectCheatButton, 1000)
    _setupInputListeners()
  }, 1000)
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

; (async () => {
  game.animes = await getAnimes()
  game.characters = await getCharacters()
  let lastUrl = location.href
  setInterval(async () => {
    if (location.href === lastUrl) return
    lastUrl = location.href
    await _handleUrlChange(lastUrl)
  }, 1000)
})()
