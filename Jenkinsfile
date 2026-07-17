pipeline {
    agent any

    tools {
        nodejs 'NodeJS 22'
    }

    environment {
        // Keep static variables here
        NODE_ENV  = 'test'
        BUILD_DIR = '.next'
        APP_NAME  = 'kijanikiosk-payments'
    }

    options {
        timeout(time: 15, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
        disableConcurrentBuilds()
    }

    stages {
        stage('Initialize') {
            steps {
                // Evaluate dynamic shell variables here, after tools are ready
                script {
                    env.PKG_VERSION = sh(script: "node -p \"require('./package.json').version\"", returnStdout: true).trim()
                    env.GIT_SHORT   = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    env.ARTIFACT_VERSION = "${env.PKG_VERSION}-${env.GIT_SHORT}"
                    
                    echo "Initialized pipeline for ${APP_NAME} v${env.ARTIFACT_VERSION}"
                }
            }
        }

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
                    credentialsId: 'nexus-credentials',   
                    usernameVariable: 'NEXUS_USER',       
                    passwordVariable: 'NEXUS_PASS'        
                )]) {
                    sh '''
                        set -e

                        # Generate base64 token from the injected credentials
                        NEXUS_TOKEN=$(echo -n "${NEXUS_USER}:${NEXUS_PASS}" | base64)

                        # Create .npmrc with the token appended correctly
                        cat > .npmrc << NPMRC
                        registry=http://localhost:8081/repository/npm-kijanikiosk-test/
                        //localhost:8081/repository/npm-kijanikiosk-test/:_auth="${NEXUS_TOKEN}"
                        //localhost:8081/repository/npm-kijanikiosk-test/:always-auth=true
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
            // This will work now because APP_NAME is safely initialized 
            echo "Pipeline FAILED: ${APP_NAME} build ${BUILD_NUMBER} - check logs"
        }
        always {
            // This will work now because the pipeline safely enters a node workspace context
            cleanWs()
        }
    }
}