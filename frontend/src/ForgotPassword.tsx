import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Mail, 
  ArrowLeft,
  Shield,
  Users
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">{t('forgotPassword.title')}</CardTitle>
          <p className="text-muted-foreground">
            {t('forgotPassword.subtitle')}
          </p>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Information Card */}
          <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  {t('forgotPassword.processTitle')}
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {t('forgotPassword.processDescription')}
                </p>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">{t('forgotPassword.whatHappensNext')}</h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-primary">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('forgotPassword.step1Title')}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('forgotPassword.step1Description')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-primary">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('forgotPassword.step2Title')}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('forgotPassword.step2Description')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-semibold text-primary">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('forgotPassword.step3Title')}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('forgotPassword.step3Description')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Information */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
            <div className="flex items-start gap-2">
              <Users className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  {t('forgotPassword.forAdmins')}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  {t('forgotPassword.adminInfo')}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link to="/login">
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t('forgotPassword.backToLogin')}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
