import { NextRequest } from 'next/server'
import { apiError, apiSuccess, handleApiCatch } from '@/lib/api/response'
import { getAlertRepository } from '@/lib/alerts/repository'
import { getRolloutMode, isKillSwitchActive } from '@/lib/alerts/rollout'
import { EmailProvider, SmsProvider, WebhookProvider } from '@/lib/alerts/providers/base'
import { runDeploymentPreflight } from '@/lib/alerts/preflight'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const deliveryId = searchParams.get('deliveryId')

    if (!deliveryId) {
      // System operational status & preflight report
      const rolloutMode = getRolloutMode()
      const killSwitch = isKillSwitchActive()
      const emailProvider = new EmailProvider()
      const smsProvider = new SmsProvider()
      const webhookProvider = new WebhookProvider()
      const repository = getAlertRepository()

      const preflight = searchParams.get('preflight') === 'true'
        ? await runDeploymentPreflight()
        : undefined

      return apiSuccess({
        rolloutMode,
        killSwitch,
        storageType: repository.storageType,
        isDurable: repository.isDurable(),
        providers: {
          webhook: { configured: webhookProvider.isConfigured() },
          email: { configured: emailProvider.isConfigured() },
          sms: { configured: smsProvider.isConfigured() },
        },
        preflight,
      })
    }

    const repository = getAlertRepository()
    const delivery = await repository.getDeliveryById(deliveryId)

    if (!delivery) {
      return apiError(`Delivery record '${deliveryId}' not found`, {
        status: 404,
        code: 'DELIVERY_NOT_FOUND',
      })
    }

    return apiSuccess({
      deliveryId: delivery.deliveryId,
      decisionId: delivery.decisionId,
      channel: delivery.channel,
      status: delivery.status,
      attemptCount: delivery.attemptCount,
      lastAttemptAt: delivery.lastAttemptAt,
      deliveredAt: delivery.deliveredAt,
      failureReason: delivery.failureReason,
      createdAt: delivery.createdAt,
    })
  } catch (err) {
    return handleApiCatch(err, 'Failed to inspect delivery status', {
      code: 'STATUS_LOOKUP_ERROR',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}
