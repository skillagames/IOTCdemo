import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/utils';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
}

class NotificationService {
  constructor() {}

  public async initializeChannels() {
    const channelId = 'primary_notifications_v3';
    
    try {
      const w = window as any;
      // Only execute if we are on a native platform where channels matter (Android)
      if (w.Capacitor?.isNativePlatform()) {
        await LocalNotifications.createChannel({
          id: channelId,
          name: 'Primary Notifications',
          description: 'General notifications',
          importance: 5, // IMPORTANCE_HIGH (Heads-up)
          visibility: 1, // VISIBILITY_PUBLIC
          vibration: true,
          sound: 'default'
        });
        
        console.log(`[NotificationService] Channel ${channelId} initialized successfully`);
      }
    } catch (e) {
      console.error('[NotificationService] Failed to create notification channel:', e);
    }
  }

  public async notify(options: NotificationOptions) {
    // Support Capacitor Local Notifications
    try {
      const w = window as any;
      if (w.Capacitor?.isNativePlatform() || w.Capacitor?.getPlatform() === 'web') {
        await LocalNotifications.schedule({ 
          notifications: [{ 
            title: options.title, 
            body: options.body, 
            id: Math.floor(Math.random() * 2147483647),
            channelId: 'primary_notifications_v3',
            vibration: true,
            smallIcon: 'ic_stat_notification',
            schedule: { at: new Date(Date.now() + 100) } // Slight delay to ensure processing
          }] 
        });
      }
    } catch (e) {
      console.warn('Capacitor notification failed:', e);
    }
  }

  public async updateFCMToken(userId: string, token: string): Promise<boolean> {
    if (!userId || !token) return false;
    const path = `users/${userId}`;
    try {
      await updateDoc(doc(db, 'users', userId), {
        fcmToken: token,
        tokenSource: 'native_bridge',
        tokenUpdatedAt: new Date().toISOString()
      });
      console.log('[NotificationService] Explicit token update successful:', token);
      return true;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, path);
      return false;
    }
  }

  private hasSentStartupNotification = false;

  public async checkDeviceExpirations(userId: string) {
    if (!userId) return;

    try {
      const alerts = await this.getAlerts(userId);
      if (alerts.length === 0) return;

      console.log(`[NotificationService] Found ${alerts.length} pending alerts for user ${userId}`);
      
      if (!this.hasSentStartupNotification) {
        this.hasSentStartupNotification = true;
        
        const expiredCount = alerts.filter(a => a.type === 'expired').length;
        const inactiveCount = alerts.filter(a => a.type === 'inactive').length;
        const expiringCount = alerts.filter(a => a.type === 'expiring').length;
        
        let bodyText = `${alerts.length} device${alerts.length > 1 ? 's' : ''} require${alerts.length === 1 ? 's' : ''} attention.`;
        
        if (expiredCount > 0 || inactiveCount > 0) {
           bodyText = `${expiredCount + inactiveCount} device(s) inactive/expired. Action needed.`;
        } else if (expiringCount > 0) {
           bodyText = `${expiringCount} device(s) expiring soon.`;
        }

        setTimeout(() => {
          this.notify({
            title: 'Device Maintenance Required',
            body: bodyText,
            icon: 'ic_stat_notification'
          });
        }, 5000);
      }

    } catch (error) {
      console.error('Error checking device expirations:', error);
    }
  }

  public dismissAlert(alertId: string) {
    const dismissed = this.getDismissedAlerts();
    if (!dismissed.includes(alertId)) {
      dismissed.push(alertId);
      localStorage.setItem('dismissed_alerts', JSON.stringify(dismissed));
      window.dispatchEvent(new CustomEvent('alerts_updated'));
    }
  }

  public dismissAllAlerts(alertIds: string[]) {
    const dismissed = this.getDismissedAlerts();
    let updated = false;
    
    alertIds.forEach(id => {
      if (!dismissed.includes(id)) {
        dismissed.push(id);
        updated = true;
      }
    });

    if (updated) {
      localStorage.setItem('dismissed_alerts', JSON.stringify(dismissed));
      window.dispatchEvent(new CustomEvent('alerts_updated'));
    }
  }

  public resetAlerts() {
    localStorage.removeItem('dismissed_alerts');
    window.dispatchEvent(new CustomEvent('alerts_updated'));
  }

  private getDismissedAlerts(): string[] {
    try {
      const data = localStorage.getItem('dismissed_alerts');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public async getAlerts(userId: string) {
    if (!userId) return [];

    try {
      const devicesRef = collection(db, 'devices');
      const q = query(devicesRef, where('ownerId', '==', userId));
      const querySnapshot = await getDocs(q);

      const now = new Date();
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(now.getDate() + 3);

      const dismissed = this.getDismissedAlerts();
      const alerts: any[] = [];

      querySnapshot.forEach((doc) => {
        const device = { id: doc.id, ...doc.data() } as any;
        const alertId = `${doc.id}-${device.subscriptionStatus === 'inactive' ? 'inactive' : 'expired'}`;
        
        if (dismissed.includes(alertId)) return;
        
        if (device.subscriptionStatus === 'inactive') {
          alerts.push({
            id: alertId,
            type: 'inactive',
            deviceId: doc.id,
            deviceName: device.name,
            date: new Date(device.lastUpdated?.seconds * 1000 || Date.now()),
            message: 'Needs active subscription'
          });
          return;
        }

        let expirationDate: Date;
        if (!device.expirationDate) return;

        if (device.expirationDate?.toDate) {
          expirationDate = device.expirationDate.toDate();
        } else if (device.expirationDate?.seconds) {
          expirationDate = new Date(device.expirationDate.seconds * 1000);
        } else {
          expirationDate = new Date(device.expirationDate);
        }

        if (expirationDate < now) {
          alerts.push({
            id: alertId,
            type: 'expired',
            deviceId: doc.id,
            deviceName: device.name,
            date: expirationDate,
            message: 'Subscription has expired'
          });
        } else if (expirationDate < threeDaysFromNow) {
          alerts.push({
            id: `${doc.id}-expiring`,
            type: 'expiring',
            deviceId: doc.id,
            deviceName: device.name,
            date: expirationDate,
            message: 'Subscription expiring soon'
          });
        }
      });

      return alerts.sort((a, b) => a.date.getTime() - b.date.getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'devices');
      return [];
    }
  }
}

export const notificationService = new NotificationService();
