import Model from 'flarum/common/Model';
import type User from 'flarum/common/models/User';

// A single shout. Registered with app.store as the 'shouts' type so reads,
// creates and deletes go through the store (cached, reactive, user sideloaded)
// instead of hand-built requests.
export default class Shout extends Model {
  content = Model.attribute<string>('content');
  canDelete = Model.attribute<boolean>('canDelete');
  createdAt = Model.attribute<Date | undefined>('createdAt', Model.transformDate);
  user = Model.hasOne<User>('user');
}
