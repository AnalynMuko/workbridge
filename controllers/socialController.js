import { SocialPost } from "../models/SocialPost.js";
import { User } from "../models/userModel.js";

export const createPost = async (req, res) => {
  try {
    const userId = req.getUserId ? req.getUserId() : null;
    if (!userId) return res.redirect('/login');

    const { content } = req.body;
    if (!content || !content.trim()) return res.redirect('/browse');

    await SocialPost.create({ userId, content: content.trim() });

    // If this post is a reply to another user, create a notification for them
    try {
      const replyToUserId = req.body.replyToUserId ? parseInt(req.body.replyToUserId, 10) : null;
      if (replyToUserId) {
        const { Notification } = await import('../models/Notification.js');
        await Notification.create({ userId: replyToUserId, type: 'reply', data: { fromUserId: userId }, read: false });
      }
    } catch (err) {
      console.error('Failed to create reply notification:', err);
    }

    res.redirect('/browse');
  } catch (error) {
    console.error('Error creating social post:', error);
    res.status(500).send('Error creating post');
  }
};

export const listPosts = async () => {
  const raw = await SocialPost.findAll({ where: { removed: false }, order: [['createdAt', 'DESC']] });
  // attach posterName and avatar
  return Promise.all(raw.map(async (p) => {
    const user = await User.findByPk(p.userId);
    let posterAvatar = null;
    try {
      const { Profile } = await import('../models/Profile.js');
      const profile = await Profile.findOne({ where: { userId: p.userId } });
      posterAvatar = profile ? profile.avatar : null;
    } catch (err) {
      posterAvatar = null;
    }
    return {
      id: p.id,
      content: p.content,
      image: p.image,
      createdAt: p.createdAt,
      posterName: user ? user.name : 'Unknown',
      posterAvatar
    };
  }));
};
