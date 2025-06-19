import fs from 'node:fs'
import { JSDOM } from 'jsdom'

type Entry = {
  titleEn: string
  titleJp: string
  score: number
  year: number
}

type EntryJson = {
  titleEn: string
  titleJp: string
  score: number
}

const fetchList = async (page: number) => {
  const limit = page * 50
  const html = await fetch(`https://myanimelist.net/topanime.php?type=bypopularity&limit=${limit}`)

  const document = (new JSDOM(await html.text())).window.document
  const rows = Array.from(document.querySelectorAll('tr.ranking-list'))
  if (rows.length === 0) throw new Error('Could not find anime list on this page.')

  return rows.map((row) => {
    // English title
    const titleEn = row.querySelector('.anime_ranking_h3 a')?.textContent?.trim() ||
                    row.querySelector('.title .hoverinfo_trigger')?.textContent?.trim() ||
                    ''
    // Japanese title (try to find in alt text or subtext, fallback to English)
    let titleJp = titleEn

    // Score
    const $score = row.querySelector('.score span')
    const score = (() => {
      const scoreStr = $score?.textContent?.replace(/_/g, '').trim()
      if (scoreStr === undefined) return NaN

      return parseFloat(scoreStr)
    })()

    // Year
    const $infoText = row.querySelector('.information')?.textContent || ''
    const year = (() => {
      const match = $infoText.match(/(\d{4})/)
      if (!match) return NaN

      return parseInt(match[1], 10)
    })()

    return {
      titleJp,
      titleEn,
      score,
      year
    }
  })
}

const groupByYear = (list: Entry[]) => {
  const grouped = list.reduce((acc, entry) => {
    const year = entry.year
    if (acc[year] === undefined) acc[year] = []
    acc[year].push(entry)
    return acc
  }, {} as Record<number, Entry[]>)
  return grouped
}

const saveToJson = (path: string, data: string) => {
  fs.writeFileSync(path, data)
}

const main = async () => {
  const pages = 15
  const listPromise = new Array(pages).fill(0).map((_, i) => fetchList(i + 1))
  const list = (await Promise.all(listPromise)).flat(1)

  const grouped = groupByYear(list)
  const minYear = 2006
  const maxYear = 2024
  const result: Record<number, EntryJson[]> = {}
  for (let year = minYear; year <= maxYear; year++) {
    const entries = grouped[year]?.slice(0, 12)
    if (!entries) {
      result[year] = []
      continue
    }

    result[year] = entries.map((entry) => ({
      titleEn: entry.titleEn,
      titleJp: entry.titleJp,
      score: entry.score
    }))
  }

  saveToJson('anime-data-mal.json', JSON.stringify(result, null, 2))
  console.log('Successfully saved to anime-data-mal.json')
}

main()
