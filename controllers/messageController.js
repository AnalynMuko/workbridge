import { Message } from "../models/Message.js";
import { User } from "../models/userModel.js";
import { Notification } from "../models/Notification.js";

// Get list of conversations for a user (last message per other user)
export const listConversations = async (userId) => {
  // find distinct other users that have messages with this user
  const sent = await Message.findAll({ where: { fromUserId: userId } });
  const received = await Message.findAll({ where: { toUserId: userId } });

  const otherIds = new Set();
  sent.forEach(m => otherIds.add(m.toUserId));
  received.forEach(m => otherIds.add(m.fromUserId));

  const convos = [];
  for (const otherId of otherIds) {
    // get last message between userId and otherId
    const last = await Message.findOne({
      where: {
        // either direction
        fromUserId: [userId, otherId],
        toUserId: [userId, otherId]
      },
      order: [['createdAt', 'DESC']]
    });
    const user = await User.findByPk(otherId);
    let otherAvatar = null;
    try {
      const { Profile } = await import('../models/Profile.js');
      const p = await Profile.findOne({ where: { userId: otherId } });
      otherAvatar = p ? p.avatar : null;
    } catch (err) {
      otherAvatar = null;
    }
    convos.push({ otherId, otherName: user ? user.name : 'Unknown', otherAvatar, lastMessage: last ? last.content : '' , lastAt: last ? last.createdAt : null });
  }

  // sort by lastAt desc
  convos.sort((a,b) => (b.lastAt || 0) - (a.lastAt || 0));
  return convos;
};

export const getConversationMessages = async (userId, otherId) => {
  return Message.findAll({
    where: {
      fromUserId: [userId, otherId],
      toUserId: [userId, otherId]
    },
    order: [['createdAt','ASC']]
  });
};

export const sendMessage = async ({ fromUserId, toUserId, content=null, jobId=null, media=null, mediaType=null }) => {
  const msg = await Message.create({ fromUserId, toUserId, content, jobId, media, mediaType });
  try {
    // create a notification for recipient
    await Notification.create({
      userId: toUserId,
      type: 'message',
      data: { fromUserId, messageId: msg.id, jobId, media },
      read: false
    });
  } catch (err) {
    console.error('Failed to create notification for message:', err);
  }
  return msg;
};
