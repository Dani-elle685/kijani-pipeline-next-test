pipeline {
    agent any

    tools {
        nodejs 'NodeJS 22'
    }

    environment {
        NODE_ENV  = 'test'
        BUILD_DIR = '.next'
        APP_NAME  = 'kijanikiosk-payments'
    
        PKG_VERSION = sh(script: "node -p \"require('./package.json').version\"",
                        returnStdout: true).trim()

        GIT_SHORT   = sh(script: 'git rev-parse --short HEAD',
                        returnStdout: true).trim()

        ARTIFACT_VERSION = "${PKG_VERSION}-${GIT_SHORT}"
    }


    options {
        timeout(time: 15, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }


    stages {
        stage('Build') {
            steps {
                echo "Installing dependencies for ${APP_NAME}..."
                sh 'npm ci'

                echo "Building application..."
                sh 'npm run build'

                echo "Verifying build output..."
                sh '''
                    set -e
                    test -d "${BUILD_DIR}" || { echo "ERROR: build directory not found"; exit 1; }
                    echo "Build output: $(ls ${BUILD_DIR} | wc -l) files in ${BUILD_DIR}/"
                    '''
            }
        }
        
        stage('Test') {
            steps {
                echo "Running test suite for ${APP_NAME}..."
                sh '''
                    set -e
                    npm test
                '''
            }
            post {
                always {
                    // Publish JUnit results so Jenkins tracks test history
                    // even if the tests failed
                    junit allowEmptyResults: true,
                        testResults: 'test-results/*.xml'
                }
            }
        }
        stage('Archive') {
            steps {
                echo "Archiving build artifact for ${APP_NAME} build ${BUILD_NUMBER}..."
                archiveArtifacts artifacts: "${BUILD_DIR}/**",
                                fingerprint: true,
                                onlyIfSuccessful: true
                echo "Artifact archived. Download from: ${BUILD_URL}artifact/"
            }
        }
        stage('Publish') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'nexus-credentials',   // The ID from the credentials store
                    usernameVariable: 'NEXUS_USER',       // Variable name for the username
                    passwordVariable: 'NEXUS_PASS'        // Variable name for the password
                )]) {
                    sh '''
                        set -e

                        # Generate base64 token from the injected credentials
                        NEXUS_TOKEN=$(echo -n "${NEXUS_USER}:${NEXUS_PASS}" | base64)

                        # Create .npmrc with the token (this file never gets committed)
                        cat > .npmrc << NPMRC
                        registry=http://localhost:8081/repository/npm-kijanikiosk-test
                        NPMRC

                        # Publish the package
                        npm publish

                        # Clean up the .npmrc with credentials
                        rm -f .npmrc
                    '''
                }
            }
        }
        
    }

    post {
        success {
            echo "Pipeline succeeded: ${APP_NAME} build ${BUILD_NUMBER}"
        }
        failure {
            echo "Pipeline FAILED: ${APP_NAME} build ${BUILD_NUMBER} - check logs"
        }
        always {
            cleanWs()
        }
    }
}

