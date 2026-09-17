class Student < ApplicationRecord
  validates :name, presence: true, length: { minimum: 4 }
  validates :email, presence: true, uniqueness: true

  def toggle_active!
    with_lock { update!(active: !active?) }
  end
end
