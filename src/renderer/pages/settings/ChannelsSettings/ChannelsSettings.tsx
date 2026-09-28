import type { FC } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader, RowFlex } from '@cherrystudio/ui'

const ChannelsSettings: FC = () => {
  const { t } = useTranslation()

  return (
    <RowFlex className="flex-1">
      <div className="flex flex-1 flex-col">
        <PageHeader title={t('settings.channels.title')} />
        <div className="flex flex-1 items-center justify-center p-8">
          <p className="text-muted-foreground text-sm">{t('agent.channels.disabled')}</p>
        </div>
      </div>
    </RowFlex>
  )
}

export default ChannelsSettings
