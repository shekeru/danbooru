class ForumPostPolicy < ApplicationPolicy
  def show?
    user.level >= record.topic.min_level
  end

  def create?
    unbanned? && policy(record.topic).reply?
  end

  def update?
    unbanned? && show? && (user.is_moderator? || (record.creator_id == user.id && !record.topic.is_locked?))
  end

  def destroy?
    unbanned? && show? && user.is_moderator?
  end

  def undelete?
    unbanned? && show? && user.is_moderator?
  end

  def show_deleted?
    !record.is_deleted? || user.is_moderator?
  end

  def permitted_attributes_for_create
    [:body, :topic_id]
  end

  def permitted_attributes_for_update
    [:body]
  end
end
