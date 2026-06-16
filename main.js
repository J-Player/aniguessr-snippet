// @ts-check

/**
 * @param {string} url
 */
async function _getData(url) {
  try {
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
 * 
 * @param {Date} date 
 * @returns 
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

let animeList

/**
 * @typedef {Object} Game
 * @property {Date} date
 * @property {string} type
 * @property {Object} response
 */

/** @type {Game} */
const game = {
  date: new Date(),
  type: "",
  response: {}
}

  ; (async () => {
    let url = "https://cms.aniguessr.com/wp-json/aniguessr/v1/autocomplete/anime"
    animeList = await _getData(url) //Carrega TODOS os animes nesta variável
    let lastUrl = location.href
    setInterval(async () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href
        let gameData = null
        const DATE = new Date()
        let dateFormatted = _formatDate(DATE)
        let gameType = null
        let baseUrl = "https://cms.aniguessr.com/wp-json/aniguessr/v1/game"
        const hasNumber = (/** @type {string} */ str) => /\d/.test(str)
        if (lastUrl.includes("replay") && hasNumber(lastUrl)) {
          const REGEX = /replay\/(\d+)\/(.+)/
          const MATCHES = lastUrl.match(REGEX)
          if (MATCHES == null) throw Error("Nenhum match foi detectado nesta URL")
          else if (MATCHES.length != 2) throw Error(`Quantidade divergentes de matches encontrados na URL: ${lastUrl}`)
          dateFormatted = MATCHES[0]
          gameType = MATCHES[1]
          baseUrl += `/${gameType}?date=${dateFormatted}`
        } else {
          const aux = lastUrl.split("/");
          gameType = aux[aux.length - 1]
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
        }
        gameData = await _getData(baseUrl)
        game["date"] = _stringToDate(dateFormatted)
        game["type"] = gameType
        game["response"] = JSON.parse(_decodeBase64(gameData["game_data"]))
        let year = dateFormatted.slice(0, 4)
        let month = dateFormatted.slice(4, 6)
        let day = dateFormatted.slice(6, 8)
        dateFormatted = `\nData: ${day}/${month}/${year}\n`
        if (gameData != null && gameData["game_data"].length > 0) {
          gameData = JSON.parse(_decodeBase64(gameData["game_data"]))
          alert(`Dados do jogo "${gameType}" obtidos com sucesso! 🥳\n` +
            dateFormatted +
            '\nPara ver a resposta acesse "game.response" no console de desenvolvedor. 😎')
        } else {
          alert(`Não foi possível encontrar os dados do jogo "${gameType}" 😭\n` +
            dateFormatted +
            '\nSe o tipo de jogo é "animdle" infelizmente não dá para trapaçear ¯\\_(ツ)_/¯')
        }
        /*
        Durante um intervalo fixo, o código irá ser executado uma única vez SEMPRE que a URL mudar:
        1. Identificar o jogo atualmente selecionado e faz uma requisição ao endpoint correspondente ao tipo de jogo
          Quais?
            screenshots => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/screenshots
            - replay    => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/screenshots?date=<DATE>
            characteres => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/characters
            - replay    => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/characters?date=<DATE>
            opening     => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/music
            - replay    => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/music?date=<DATE>
            ending      => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/endings
            - replay    => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/endings?date=<DATE>
            anidle      => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/animdle
            - replay    => https://cms.aniguessr.com/wp-json/aniguessr/v1/game/animdle?date=<DATE>
        2. Buscará os dados relacionados ao jogo atual e armazena o resultado na variável "game"
        */
      }
    }, 1000)
  })()