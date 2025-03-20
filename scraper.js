const TelegramBot = require('node-telegram-bot-api')
const axios = require('axios')
const cheerio = require('cheerio')

// Токен вашого бота
const token = '7959868199:AAHu4WdIcdU-aye3xaSrvyORQkwvimKgdec'
const bot = new TelegramBot(token, { polling: true })

// Функція для очищення та форматування ціни
function cleanPrice(priceText) {
	if (!priceText || !priceText.trim()) return null
	const cleanedPrice = priceText.replace(/[^0-9]/g, '').trim()
	const formattedPrice = cleanedPrice.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
	return formattedPrice ? `${formattedPrice}` : null
}

// Функція для очищення назви товару
function cleanTitle(title) {
	if (!title) return ''
	return title.replace(/"/g, "''").trim()
}

// Функція для розрахунку кількості платежів
function calculateInstallments(newPrice, creditPrice) {
	if (!newPrice || !creditPrice) return null
	const newPriceNumber = parseFloat(newPrice.replace(/\s/g, ''))
	const creditPriceNumber = parseFloat(creditPrice.replace(/\s/g, ''))
	if (isNaN(newPriceNumber) || isNaN(creditPriceNumber)) return null
	return Math.ceil(newPriceNumber / creditPriceNumber)
}

// Функція для отримання інформації про товар
async function getProductInfo(productId) {
	const searchUrl = `https://allo.ua/ua/catalogsearch/result/?q=${productId}`
	try {
		const { data } = await axios.get(searchUrl)
		const $ = cheerio.load(data)
		const firstProductLink = $('.product-card__title').first().attr('href')

		if (!firstProductLink) throw new Error('Товар не знайдено')

		const productResponse = await axios.get(firstProductLink)
		const $$ = cheerio.load(productResponse.data)

		const title = cleanTitle($$('.p-view__header-title').text().trim())
		const oldPrice = cleanPrice($$('.p-trade-price__old > .sum').text().trim())
		const newPrice = cleanPrice(
			$$('.p-trade-price__current > .sum').text().trim()
		)
		const creditPrice = cleanPrice($$('.p-credit-button__price').text().trim())
		const image = $$('.main-gallery__link img').attr('src')
		const installments = calculateInstallments(newPrice, creditPrice)

		return {
			title,
			oldPrice,
			newPrice,
			creditPrice,
			installments,
			image,
			productUrl: firstProductLink,
		}
	} catch (error) {
		console.error(
			`Помилка при отриманні даних для товару ${productId}:`,
			error.message
		)
		return null
	}
}

// Обробник команди /start
bot.onText(/\/start/, msg => {
	const chatId = msg.chat.id
	bot.sendMessage(
		chatId,
		'Введіть ID товару з Allo.ua, наприклад: /product 1124218'
	)
})

// Обробник команди /product
bot.onText(/\/product (.+)/, async (msg, match) => {
	const chatId = msg.chat.id
	const productId = match[1]

	const productInfo = await getProductInfo(productId)
	if (productInfo) {
		let message = `Назва: ${productInfo.title}\n`
		if (productInfo.oldPrice)
			message += `Стара ціна: ${productInfo.oldPrice} ₴\n`
		message += `Нова ціна: ${productInfo.newPrice} ₴\n`
		if (productInfo.creditPrice)
			message += `Ціна в кредит: ${productInfo.creditPrice} ₴\n`
		if (productInfo.installments)
			message += `Кількість платежів: ${productInfo.installments}\n`
		message += `Посилання: ${productInfo.productUrl}`

		bot.sendMessage(chatId, message)
		if (productInfo.image) bot.sendPhoto(chatId, productInfo.image)
	} else {
		bot.sendMessage(
			chatId,
			'Не вдалося отримати інформацію про товар. Перевірте ID.'
		)
	}
})
