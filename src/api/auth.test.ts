import { describe, expect, it } from 'vitest'
import { buildGithubWebLoginUrl } from './auth'

describe('buildGithubWebLoginUrl', () => {
  it('builds the GitHub web login url with redirect and frontend origin', () => {
    const url = buildGithubWebLoginUrl({
      redirect: '/user/upload?from=market',
      frontendOrigin: 'http://localhost:5173',
    })

    expect(url).toBe(
      '/api/v1/auth/github/web/start?redirect=%2Fuser%2Fupload%3Ffrom%3Dmarket&frontendOrigin=http%3A%2F%2Flocalhost%3A5173',
    )
  })

  it('omits empty parameters', () => {
    expect(buildGithubWebLoginUrl()).toBe('/api/v1/auth/github/web/start')
  })
})
