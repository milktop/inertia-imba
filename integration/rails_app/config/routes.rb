Rails.application.routes.draw do
  resources :students, only: %i[index create] do
    get :reports, on: :collection
    patch :toggle_active, on: :member
  end
  resources :action_examples, only: %i[index create update destroy]
  resources :uploads, only: %i[index create]

  get "about", to: "pages#about"
  get "forms", to: "pages#forms"
  get "loading", to: "pages#loading"

  post "http-preview", to: "http_previews#create", as: :http_preview

  root "pages#index"
end
