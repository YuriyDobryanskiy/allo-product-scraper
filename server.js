const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')

// Функція для очищення та форматування ціни
function cleanPrice(priceText) {
	if (!priceText || !priceText.trim()) return null // Якщо немає тексту або лише пробіли, повертаємо null
	const cleanedPrice = priceText.replace(/[^0-9]/g, '').trim() // Видаляємо всі символи, крім цифр

	// Додаємо пробіл для тисяч
	const formattedPrice = cleanedPrice.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

	return formattedPrice ? `${formattedPrice}` : null // Повертаємо відформатовану ціну
}

// Функція для очищення назви товару
function cleanTitle(title) {
	if (!title) return '' // Якщо немає тексту, повертаємо порожній рядок
	return title.replace(/"/g, "''").trim() // Замінюємо подвійні лапки на одинарні
}

// Функція для розрахунку кількості платежів
function calculateInstallments(newPrice, creditPrice) {
	if (!newPrice || !creditPrice) return null // Якщо немає цін, повертаємо null

	// Видаляємо пробіли та перетворюємо на числа
	const newPriceNumber = parseFloat(newPrice.replace(/\s/g, ''))
	const creditPriceNumber = parseFloat(creditPrice.replace(/\s/g, ''))

	if (isNaN(newPriceNumber)) return null // Якщо newPrice не є числом
	if (isNaN(creditPriceNumber)) return null // Якщо creditPrice не є числом

	// Розраховуємо кількість платежів і округляємо в більшу сторону
	const installments = Math.ceil(newPriceNumber / creditPriceNumber)
	return installments
}

async function getFirstProductUrl(productId) {
	const searchUrl = `https://allo.ua/ua/catalogsearch/result/?q=${productId}`

	try {
		const { data } = await axios.get(searchUrl)
		const $ = cheerio.load(data)
		const firstProductLink = $('.product-card__title').first().attr('href')

		if (!firstProductLink) {
			throw new Error('Товар не знайдено')
		}

		return firstProductLink
	} catch (error) {
		console.error(
			`Помилка при отриманні URL товару (ID: ${productId}):`,
			error.message
		)
		return null
	}
}

async function getProductInfo(productUrl) {
	try {
		const { data } = await axios.get(productUrl)
		const $ = cheerio.load(data)

		// Отримуємо необхідні дані
		const title = cleanTitle($('.p-view__header-title').text().trim())
		const oldPriceRaw = $('.p-trade-price__old > .sum').text().trim()
		const newPriceRaw = $('.p-trade-price__current > .sum').text().trim()
		const creditPriceRaw = $('.p-credit-button__price').text().trim()
		const image = $('.main-gallery__link img').attr('src')

		// Очищуємо ціни
		const oldPrice = cleanPrice(oldPriceRaw)
		const newPrice = cleanPrice(newPriceRaw)
		const creditPrice = cleanPrice(creditPriceRaw)

		// Розраховуємо кількість платежів
		const installments = calculateInstallments(newPrice, creditPrice)

		// Формуємо об'єкт результату
		const result = {
			title,
			image,
			productUrl,
		}

		// Додаємо ціни лише якщо вони існують
		if (oldPrice) result.oldPrice = oldPrice
		if (newPrice) result.newPrice = newPrice
		if (creditPrice) result.creditPrice = creditPrice
		if (installments) result.installments = installments

		return result
	} catch (error) {
		console.error(
			'Помилка при отриманні даних зі сторінки товару:',
			error.message
		)
		return null
	}
}

async function processProductIds(productIds) {
	const results = []

	for (const productId of productIds) {
		console.log(`Обробка товару з ID: ${productId}`)
		const productUrl = await getFirstProductUrl(productId)

		if (productUrl) {
			const productInfo = await getProductInfo(productUrl)
			if (productInfo) {
				results.push({ productId, ...productInfo })
			}
		}
	}

	return results
}

// Приклад використання
const productIds = ['1124218', '1068332'] // Замініть на реальні ID товарів
processProductIds(productIds).then(results => {
	console.log('Результати:', results)

	// Збереження результатів у файл JSON
	fs.writeFileSync('products.json', JSON.stringify(results, null, 2))
	console.log('Результати збережено у файл products.json')
})
