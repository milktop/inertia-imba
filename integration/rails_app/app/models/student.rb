class Student < ApplicationRecord
  validates :name, presence: true, length: { minimum: 4 }
  validates :email, presence: true, uniqueness: true
end
