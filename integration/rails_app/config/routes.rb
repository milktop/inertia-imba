Rails.application.routes.draw do
  resources :students, only: %i[index create]

  get "about", to: "pages#about"
  get "forms", to: "pages#forms"

  post "http-preview", to: "http_previews#create", as: :http_preview

  root "pages#index"
end
