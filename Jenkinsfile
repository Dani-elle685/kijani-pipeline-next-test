pipeline {
    agent {
        docker {
            image 'node:22'
            args '-u root'
        }
    }

    environment {
        NODE_ENV = 'test'
        BUILD_DIR = '.next'
        APP_NAME = 'kijanikiosk-payments'
    }

    options {
        timeout(time: 15, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    stages {
        stage('Environment') {
            steps {
                sh '''
                    echo "Node version:"
                    node -v

                    echo "NPM version:"
                    npm -v
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                echo "Installing dependencies..."
                sh 'npm ci'
            }
        }

        stage('Build') {
            steps {
                echo "Building ${APP_NAME}..."
                sh 'npm run build'
            }
        }

        stage('Verify Build') {
            steps {
                sh '''
                    set -e

                    if [ ! -d "${BUILD_DIR}" ]; then
                        echo "ERROR: ${BUILD_DIR} directory not found."
                        exit 1
                    fi

                    echo "Build completed successfully."
                    ls -la ${BUILD_DIR}
                '''
            }
        }

        stage('Test') {
            steps {
                sh '''
                    if npm run | grep -q " test"; then
                        npm test
                    else
                        echo "No test script found. Skipping tests."
                    fi
                '''
            }
        }

        stage('Archive') {
            steps {
                archiveArtifacts artifacts: '.next/**', fingerprint: true
            }
        }
    }

    post {
        success {
            echo "✅ ${APP_NAME} build #${BUILD_NUMBER} completed successfully."
        }

        failure {
            echo "❌ ${APP_NAME} build #${BUILD_NUMBER} failed."
        }

        always {
            echo "Build URL: ${BUILD_URL}"
            cleanWs()
        }
    }
}