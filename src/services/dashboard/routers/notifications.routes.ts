import { Router, Request, Response } from 'express';
import { notificationService } from '../../notifications.js';

const router = Router();

// Get all notifications
router.get('/', (req: Request, res: Response) => {
    res.json(notificationService.getAll());
});

// Get unread notifications
router.get('/unread', (req: Request, res: Response) => {
    res.json(notificationService.getUnread());
});

// Get unread count
router.get('/unread/count', (req: Request, res: Response) => {
    res.json({ count: notificationService.getUnreadCount() });
});

// Mark a notification as read
router.post('/:id/read', (req: Request, res: Response) => {
    const success = notificationService.markAsRead(req.params.id as string);
    if (success) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Notification not found' });
    }
});

// Mark all as read
router.post('/read-all', (req: Request, res: Response) => {
    const count = notificationService.markAllAsRead();
    res.json({ success: true, count });
});

// Delete a notification
router.delete('/:id', (req: Request, res: Response) => {
    const success = notificationService.delete(req.params.id as string);
    if (success) {
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Notification not found' });
    }
});

// Clear all notifications
router.delete('/', (req: Request, res: Response) => {
    notificationService.clearAll();
    res.json({ success: true });
});

export default router;
